import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAR_LIMIT, DEFAULT_TOPIC, DEFAULT_USER_NAME, STORAGE_KEYS, TOPICS } from '@/domain/constants'
import type { Post } from '@/domain/posts'
import { useForumStore } from '@/stores/forum'

const NOW = new Date(2026, 2, 5, 12, 0, 0).getTime()

function readStoredPosts(): Post[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.posts) ?? '[]') as Post[]
}

function storedPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'stored-1',
    authorId: 'user-me',
    author: '微波过客',
    topic: '随笔',
    content: '来自本地存储',
    createdAt: NOW,
    likes: 2,
    likedByMe: false,
    ...overrides,
  }
}

function seedStorage(posts: Post[], user?: { id: string; name: string }) {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts))
  if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('数据加载与持久化', () => {
  it('首次访问写入 3 条示例动态与本地身份', () => {
    const store = useForumStore()

    expect(store.posts).toHaveLength(3)
    expect(readStoredPosts()).toHaveLength(3)
    expect(store.user.name).toBe(DEFAULT_USER_NAME)
    expect(store.user.id).toEqual(expect.any(String))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.user)!)).toEqual(store.user)
    expect(store.storageAvailable).toBe(true)
  })

  it('已有数据时按存储内容恢复，不再写入示例', () => {
    seedStorage([storedPost({ id: 'only-one' })], { id: 'local-user', name: '本机用户' })

    const store = useForumStore()

    expect(store.posts.map((post) => post.id)).toEqual(['only-one'])
    expect(store.user).toEqual({ id: 'local-user', name: '本机用户' })
    expect(readStoredPosts()).toHaveLength(1)
  })

  it('存储内容损坏时回落为示例内容', () => {
    localStorage.setItem(STORAGE_KEYS.posts, '{ not json')
    const store = useForumStore()

    expect(store.posts).toHaveLength(3)
  })

  it('本地身份缺少 id 时补齐并写回', () => {
    seedStorage([storedPost()], { id: '', name: '旧昵称' })
    const store = useForumStore()

    expect(store.user.name).toBe('旧昵称')
    expect(store.user.id).toEqual(expect.any(String))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.user)!).id).toBe(store.user.id)
  })

  it('存储写入失败时降级为内存态但不影响使用', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    const store = useForumStore()
    store.publish('依然可以发布')

    expect(store.storageAvailable).toBe(false)
    expect(store.posts[0]!.content).toBe('依然可以发布')
  })
})

describe('发布动态', () => {
  it('发布后置顶、写入存储，并回到实时视图', () => {
    const store = useForumStore()
    store.setView('hot')
    store.setTopic('科技')
    store.setQuery('关键词')
    store.setComposeTopic('生活')

    const result = store.publish('  新的一条动态  ')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post).toMatchObject({
      content: '新的一条动态',
      topic: '生活',
      author: store.user.name,
      authorId: store.user.id,
      likes: 0,
      likedByMe: false,
    })
    expect(store.posts[0]!.id).toBe(result.post.id)
    expect(store.view).toBe('live')
    expect(store.topic).toBe('')
    expect(store.query).toBe('')
    expect(readStoredPosts()[0]!.content).toBe('新的一条动态')
  })

  it('空内容与全空白内容被拒绝', () => {
    const store = useForumStore()
    expect(store.publish('')).toEqual({ ok: false, reason: 'empty' })
    expect(store.publish('   \n  ')).toEqual({ ok: false, reason: 'empty' })
    expect(store.posts).toHaveLength(3)
  })

  it('超过 140 字被拒绝，正好 140 字可以发布', () => {
    const store = useForumStore()

    expect(store.publish('字'.repeat(CHAR_LIMIT + 1))).toEqual({ ok: false, reason: 'too-long' })
    expect(store.posts).toHaveLength(3)

    expect(store.publish('字'.repeat(CHAR_LIMIT)).ok).toBe(true)
    expect(store.posts[0]!.content).toHaveLength(CHAR_LIMIT)
  })

  it('emoji 超限按字符数判断', () => {
    const store = useForumStore()
    expect(store.publish('🍵'.repeat(CHAR_LIMIT + 1))).toEqual({ ok: false, reason: 'too-long' })
    expect(store.publish('🍵'.repeat(CHAR_LIMIT)).ok).toBe(true)
  })
})

describe('点赞', () => {
  it('点赞与取消点赞同步数量、状态与存储', () => {
    seedStorage([storedPost()])
    const store = useForumStore()

    expect(store.toggleLike('stored-1')).toBe(true)
    expect(store.posts[0]).toMatchObject({ likes: 3, likedByMe: true })
    expect(readStoredPosts()[0]).toMatchObject({ likes: 3, likedByMe: true })

    expect(store.toggleLike('stored-1')).toBe(true)
    expect(store.posts[0]).toMatchObject({ likes: 2, likedByMe: false })
    expect(readStoredPosts()[0]).toMatchObject({ likes: 2, likedByMe: false })
  })

  it('点赞数不会小于 0', () => {
    seedStorage([storedPost({ likes: 0, likedByMe: true })])
    const store = useForumStore()

    store.toggleLike('stored-1')
    expect(store.posts[0]!.likedByMe).toBe(false)
    expect(store.posts[0]!.likes).toBe(0)
  })

  it('未知动态返回 false', () => {
    const store = useForumStore()
    expect(store.toggleLike('missing')).toBe(false)
  })

  it('点赞后影响统计、导航计数与热榜', () => {
    seedStorage([storedPost({ id: 'a', likes: 0 }), storedPost({ id: 'b', likes: 5 })])
    const store = useForumStore()
    store.toggleLike('a')

    expect(store.stats.likes).toBe(6)
    expect(store.navCounts.liked).toBe(1)
    expect(store.hotBoard.items[0]!.id).toBe('b')
    expect(store.hotBoard.items[1]!.likes).toBe(1)
  })
})

describe('删除动态', () => {
  it('可以删除自己的动态并持久化', () => {
    seedStorage([storedPost({ id: 'mine', authorId: 'me' }), storedPost({ id: 'other', authorId: 'other' })], {
      id: 'me',
      name: '我',
    })
    const store = useForumStore()

    expect(store.removePost('mine')).toBe('removed')
    expect(store.posts.map((post) => post.id)).toEqual(['other'])
    expect(readStoredPosts().map((post) => post.id)).toEqual(['other'])
  })

  it('不能删除他人的动态', () => {
    seedStorage([storedPost({ id: 'other', authorId: 'other' })], { id: 'me', name: '我' })
    const store = useForumStore()

    expect(store.removePost('other')).toBe('forbidden')
    expect(store.posts).toHaveLength(1)
  })

  it('删除不存在的动态返回 not-found', () => {
    seedStorage([storedPost()], { id: 'me', name: '我' })
    const store = useForumStore()
    expect(store.removePost('missing')).toBe('not-found')
  })
})

describe('修改昵称', () => {
  it('更新本人动态的作者名并持久化', () => {
    seedStorage(
      [storedPost({ id: 'mine', authorId: 'me', author: '旧名字' }), storedPost({ id: 'other', authorId: 'other', author: '别人' })],
      { id: 'me', name: '旧名字' },
    )
    const store = useForumStore()

    expect(store.renameUser(' 新昵称 ')).toEqual({ ok: true })
    expect(store.user.name).toBe('新昵称')
    expect(store.posts.find((post) => post.id === 'mine')!.author).toBe('新昵称')
    expect(store.posts.find((post) => post.id === 'other')!.author).toBe('别人')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.user)!).name).toBe('新昵称')
    expect(readStoredPosts().find((post) => post.id === 'mine')!.author).toBe('新昵称')
  })

  it('昵称按字符截断为 12 个字符', () => {
    seedStorage([storedPost()], { id: 'me', name: '我' })
    const store = useForumStore()

    store.renameUser('一二三四五六七八九十十一十二十三')
    expect(store.user.name).toBe('一二三四五六七八九十十一')
    expect(Array.from(store.user.name)).toHaveLength(12)
  })

  it('空昵称被拒绝', () => {
    seedStorage([storedPost()], { id: 'me', name: '我' })
    const store = useForumStore()

    expect(store.renameUser('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(store.user.name).toBe('我')
  })
})

describe('筛选、视图与统计', () => {
  beforeEach(() => {
    seedStorage(
      [
        storedPost({ id: 'tech', topic: '科技', content: 'Vue 组件', createdAt: NOW, likes: 5 }),
        storedPost({ id: 'life', topic: '生活', content: '晚饭吃什么', createdAt: NOW - 10, likes: 0, likedByMe: true }),
        storedPost({
          id: 'other',
          authorId: 'other',
          topic: '随笔',
          content: '别人的随笔',
          createdAt: NOW - 20,
          likes: 0,
        }),
      ],
      { id: 'user-me', name: '微波过客' },
    )
  })

  it('默认实时视图按时间倒序，可切换热门/我的/我赞过的', () => {
    const store = useForumStore()
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech', 'life', 'other'])

    store.setView('hot')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech', 'life', 'other'])

    store.setView('mine')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech', 'life'])

    store.setView('liked')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['life'])
  })

  it('板块筛选与搜索可叠加', () => {
    const store = useForumStore()
    store.setTopic('科技')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech'])

    store.setTopic('')
    store.setQuery('随笔')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['other'])
  })

  it('导航计数与统计随内容变化', () => {
    const store = useForumStore()

    expect(store.navCounts).toEqual({ live: 3, hot: 1, liked: 1, mine: 2 })
    expect(store.stats).toEqual({
      posts: 3,
      likes: 5,
      topics: TOPICS.length,
      quick: '本地社区 · 3 条动态 · 5 次点赞',
    })

    store.toggleLike('other')
    expect(store.navCounts.hot).toBe(2)
    expect(store.stats.likes).toBe(6)
  })

  it('空数据时计数归零', () => {
    seedStorage([], { id: 'user-me', name: '我' })
    const store = useForumStore()

    expect(store.navCounts).toEqual({ live: 0, hot: 0, liked: 0, mine: 0 })
    expect(store.stats.likes).toBe(0)
  })
})

describe('热榜交互', () => {
  function seedMany(count: number) {
    seedStorage(
      Array.from({ length: count }, (_, index) =>
        storedPost({
          id: `p-${index}`,
          content: `第 ${index} 条`,
          likes: count - index,
          createdAt: NOW - index,
        }),
      ),
    )
  }

  it('默认展示 6 条，展开后展示更多并可收起', () => {
    seedMany(9)
    const store = useForumStore()

    expect(store.hotBoard.items).toHaveLength(6)
    expect(store.hotBoard.canToggle).toBe(true)

    store.toggleHotExpanded()
    expect(store.hotExpanded).toBe(true)
    expect(store.hotBoard.items).toHaveLength(9)

    store.toggleHotExpanded()
    expect(store.hotBoard.items).toHaveLength(6)
  })

  it('换一换轮转榜单', () => {
    seedMany(9)
    const store = useForumStore()
    const before = store.hotBoard.items.map((post) => post.id)

    store.refreshHot()

    expect(store.hotOffset).toBe(1)
    expect(store.hotBoard.items.map((post) => post.id)).not.toEqual(before)
    expect(store.hotBoard.total).toBe(9)
  })

  it('内容不足 6 条时隐藏「查看更多」', () => {
    seedMany(4)
    const store = useForumStore()
    expect(store.hotBoard.canToggle).toBe(false)
    expect(store.hotBoard.items).toHaveLength(4)
  })
})

describe('选项常量', () => {
  it('板块顺序与默认板块保持旧版一致', () => {
    expect(TOPICS).toEqual(['随笔', '生活', '科技', '心情'])
    expect(DEFAULT_TOPIC).toBe('随笔')
  })
})
