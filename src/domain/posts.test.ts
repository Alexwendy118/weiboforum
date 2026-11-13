import { describe, expect, it } from 'vitest'
import { DEFAULT_TOPIC } from '@/domain/constants'
import {
  avatarSeedOf,
  createSeedPosts,
  filterPosts,
  normalizePosts,
  normalizeTopic,
  sortPostsForView,
  type Post,
} from '@/domain/posts'

const NOW = new Date(2026, 2, 5, 12, 0, 0).getTime()

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-1',
    authorId: 'user-1',
    author: '微波过客',
    topic: '随笔',
    content: '测试内容',
    createdAt: NOW,
    likes: 0,
    likedByMe: false,
    favorited: false,
    ...overrides,
  }
}

describe('normalizeTopic', () => {
  it('合法板块原样返回', () => {
    expect(normalizeTopic('科技')).toBe('科技')
  })

  it('非法或缺失时回落为默认板块', () => {
    expect(normalizeTopic('不存在')).toBe(DEFAULT_TOPIC)
    expect(normalizeTopic(undefined)).toBe(DEFAULT_TOPIC)
    expect(normalizeTopic(42)).toBe(DEFAULT_TOPIC)
  })
})

describe('normalizePosts', () => {
  it('非数组输入返回空列表', () => {
    expect(normalizePosts(null)).toEqual([])
    expect(normalizePosts({})).toEqual([])
    expect(normalizePosts('x')).toEqual([])
  })

  it('丢弃没有有效正文的条目', () => {
    const list = normalizePosts([
      null,
      { content: '   ' },
      { content: 123 },
      { content: '保留我' },
    ])
    expect(list).toHaveLength(1)
    expect(list[0]?.content).toBe('保留我')
  })

  it('补齐缺失字段并修正非法值', () => {
    const [post] = normalizePosts([
      { content: '旧数据', likes: -3, createdAt: 'oops', topic: '未知', likedByMe: 1 },
    ]) as [Post]

    expect(post.id).toEqual(expect.any(String))
    expect(post.authorId).toBe('unknown')
    expect(post.author).toBe('匿名用户')
    expect(post.topic).toBe(DEFAULT_TOPIC)
    expect(post.likes).toBe(0)
    expect(post.likedByMe).toBe(true)
    expect(post.createdAt).toBeGreaterThan(0)
  })

  it('保留完整字段', () => {
    const [post] = normalizePosts([makePost({ id: 'keep-me', likes: 7, likedByMe: true })])
    expect(post).toMatchObject({
      id: 'keep-me',
      authorId: 'user-1',
      author: '微波过客',
      topic: '随笔',
      content: '测试内容',
      createdAt: NOW,
      likes: 7,
      likedByMe: true,
      favorited: false,
    })
  })

  it('收藏状态按布尔规范化，缺失时为 false', () => {
    const [post] = normalizePosts([{ content: '带收藏标记', favorited: 1 }])
    expect(post!.favorited).toBe(true)

    const [fallback] = normalizePosts([{ content: '缺收藏标记' }])
    expect(fallback!.favorited).toBe(false)
  })
})

describe('createSeedPosts', () => {
  it('生成 3 条示例动态，时间依次更早', () => {
    const seeds = createSeedPosts(NOW)
    expect(seeds).toHaveLength(3)
    expect(seeds.map((post) => post.id)).toEqual(['seed-1', 'seed-2', 'seed-3'])
    expect(seeds[0]!.createdAt).toBe(NOW - 6 * 60_000)
    expect(seeds[1]!.createdAt - seeds[0]!.createdAt).toBe(-68 * 60_000)
    expect(seeds.every((post) => post.likedByMe === false)).toBe(true)
  })

  it('示例动态都带合法板块与点赞数', () => {
    const seeds = createSeedPosts(NOW)
    expect(seeds.map((post) => post.topic)).toEqual(['生活', '心情', '随笔'])
    expect(seeds.map((post) => post.likes)).toEqual([12, 28, 7])
  })
})

describe('filterPosts', () => {
  const posts: Post[] = [
    makePost({ id: 'a', content: '今天写 Vue 组件', author: '微波小厨', topic: '科技' }),
    makePost({ id: 'b', authorId: 'user-2', content: '天气不错', author: '路人', topic: '生活' }),
    makePost({ id: 'c', content: '被点赞的随笔', topic: '随笔', likedByMe: true, favorited: true }),
  ]
  const base = { view: 'live' as const, topic: '' as const, query: '', userId: 'user-1' }

  it('实时视图展示全部内容', () => {
    expect(filterPosts(posts, base).map((post) => post.id)).toEqual(['a', 'b', 'c'])
  })

  it('我的动态只保留自己的内容', () => {
    expect(filterPosts(posts, { ...base, view: 'mine' }).map((post) => post.id)).toEqual(['a', 'c'])
  })

  it('我赞过的只保留已点赞内容', () => {
    expect(filterPosts(posts, { ...base, view: 'liked' }).map((post) => post.id)).toEqual(['c'])
  })

  it('我收藏的只保留已收藏内容，且可与板块叠加', () => {
    expect(filterPosts(posts, { ...base, view: 'favorites' }).map((post) => post.id)).toEqual(['c'])
    expect(filterPosts(posts, { ...base, view: 'favorites', topic: '科技' })).toEqual([])
  })

  it('板块筛选可叠加视图', () => {
    expect(filterPosts(posts, { ...base, topic: '生活' }).map((post) => post.id)).toEqual(['b'])
    expect(filterPosts(posts, { ...base, view: 'mine', topic: '科技' })).toHaveLength(1)
  })

  it('搜索匹配正文、昵称与板块，且忽略大小写', () => {
    expect(filterPosts(posts, { ...base, query: 'vue' }).map((post) => post.id)).toEqual(['a'])
    expect(filterPosts(posts, { ...base, query: '路人' }).map((post) => post.id)).toEqual(['b'])
    expect(filterPosts(posts, { ...base, query: '随笔' }).map((post) => post.id)).toEqual(['c'])
    expect(filterPosts(posts, { ...base, query: '  小厨  ' }).map((post) => post.id)).toEqual(['a'])
  })

  it('没有匹配项时返回空数组', () => {
    expect(filterPosts(posts, { ...base, query: '找不到' })).toEqual([])
  })
})

describe('sortPostsForView', () => {
  const posts: Post[] = [
    makePost({ id: 'old-popular', createdAt: NOW - 1000, likes: 9 }),
    makePost({ id: 'new', createdAt: NOW, likes: 0 }),
    makePost({ id: 'mid', createdAt: NOW - 500, likes: 9 }),
  ]

  it('实时视图按时间倒序', () => {
    expect(sortPostsForView(posts, 'live').map((post) => post.id)).toEqual([
      'new',
      'mid',
      'old-popular',
    ])
  })

  it('热门视图按点赞倒序，点赞相同则时间倒序', () => {
    expect(sortPostsForView(posts, 'hot').map((post) => post.id)).toEqual([
      'mid',
      'old-popular',
      'new',
    ])
  })

  it('不修改原数组', () => {
    const snapshot = posts.map((post) => post.id)
    sortPostsForView(posts, 'hot')
    expect(posts.map((post) => post.id)).toEqual(snapshot)
  })
})

describe('avatarSeedOf', () => {
  it('由作者 id 与昵称共同决定头像', () => {
    expect(avatarSeedOf({ authorId: 'seed-author-1', author: '微波小厨' })).toBe(
      'seed-author-1微波小厨',
    )
  })
})
