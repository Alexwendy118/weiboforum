import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHAR_LIMIT, DEFAULT_TOPIC, DEFAULT_USER_NAME, TOPICS } from '@/domain/constants'
import type { Post } from '@/domain/posts'
import { useForumStore } from '@/stores/forum'
import { apiPosts, apiUser, failNextRequests, installFakeApi, seedApi } from '@/test/fakeApi'

const NOW = new Date(2026, 2, 5, 12, 0, 0).getTime()

function storedPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'stored-1',
    authorId: 'user-me',
    author: '微波过客',
    topic: '随笔',
    content: '来自后端的数据',
    createdAt: NOW,
    likes: 2,
    likedByMe: false,
    favorited: false,
    ...overrides,
  }
}

async function createStore() {
  const store = useForumStore()
  await flushPromises()
  return store
}

beforeEach(() => {
  installFakeApi()
  setActivePinia(createPinia())
})

describe('数据加载', () => {
  it('首次加载从后端拉取 3 条示例动态与当前身份', async () => {
    const store = useForumStore()
    expect(store.loading).toBe(true)

    await flushPromises()

    expect(store.loading).toBe(false)
    expect(store.apiAvailable).toBe(true)
    expect(store.posts).toHaveLength(3)
    expect(apiPosts()).toHaveLength(3)
    expect(store.user.name).toBe(DEFAULT_USER_NAME)
    expect(store.user.id).toEqual(expect.any(String))
    expect(apiUser().id).toBe(store.user.id)
  })

  it('后端已有数据时按返回内容恢复，不再播种', async () => {
    seedApi([storedPost({ id: 'only-one' })], { id: 'local-user', name: '本机用户' })

    const store = await createStore()

    expect(store.posts.map((post) => post.id)).toEqual(['only-one'])
    expect(store.user).toEqual({ id: 'local-user', name: '本机用户' })
  })

  it('后端返回空列表时展示 0 条，不回落为示例内容', async () => {
    seedApi([], { id: 'user-me', name: '我' })

    const store = await createStore()

    expect(store.posts).toHaveLength(0)
    expect(store.stats.posts).toBe(0)
  })

  it('后端不可用时降级为空数据并标记 apiAvailable=false', async () => {
    failNextRequests(2)

    const store = await createStore()

    expect(store.loading).toBe(false)
    expect(store.apiAvailable).toBe(false)
    expect(store.posts).toEqual([])
  })

  it('昵称超长时按 12 个字符截断', async () => {
    seedApi([storedPost()], { id: 'me', name: '我' })
    const store = await createStore()

    await store.renameUser('一二三四五六七八九十十一十二十三')

    expect(Array.from(store.user.name)).toHaveLength(12)
    expect(apiUser().name).toBe('一二三四五六七八九十十一')
  })
})

describe('发布动态', () => {
  it('发布后置顶、写入后端，并回到实时视图', async () => {
    const store = await createStore()
    store.setView('hot')
    store.setTopic('科技')
    store.setQuery('关键词')
    store.setComposeTopic('生活')

    const result = await store.publish('  新的一条动态  ')

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
    expect(apiPosts()[0]!.content).toBe('新的一条动态')
  })

  it('空内容与全空白内容被拒绝', async () => {
    const store = await createStore()

    expect(await store.publish('')).toEqual({ ok: false, reason: 'empty' })
    expect(await store.publish('   \n  ')).toEqual({ ok: false, reason: 'empty' })
    expect(store.posts).toHaveLength(3)
  })

  it('超过 140 字被拒绝，正好 140 字可以发布', async () => {
    const store = await createStore()

    expect(await store.publish('字'.repeat(CHAR_LIMIT + 1))).toEqual({
      ok: false,
      reason: 'too-long',
    })
    expect(store.posts).toHaveLength(3)

    expect((await store.publish('字'.repeat(CHAR_LIMIT))).ok).toBe(true)
    expect(store.posts[0]!.content).toHaveLength(CHAR_LIMIT)
  })

  it('emoji 超限按字符数判断', async () => {
    const store = await createStore()

    expect(await store.publish('🍵'.repeat(CHAR_LIMIT + 1))).toEqual({
      ok: false,
      reason: 'too-long',
    })
    expect((await store.publish('🍵'.repeat(CHAR_LIMIT))).ok).toBe(true)
  })

  it('网络失败时返回 network 且不新增动态', async () => {
    const store = await createStore()
    const before = store.posts.length
    failNextRequests(1)

    expect(await store.publish('发不出去')).toEqual({ ok: false, reason: 'network' })
    expect(store.posts).toHaveLength(before)
    expect(store.apiAvailable).toBe(false)
  })
})

describe('点赞', () => {
  it('点赞与取消点赞同步数量、状态与后端', async () => {
    seedApi([storedPost()])
    const store = await createStore()

    expect(await store.toggleLike('stored-1')).toBe(true)
    expect(store.posts[0]).toMatchObject({ likes: 3, likedByMe: true })
    expect(apiPosts()[0]).toMatchObject({ likes: 3, likedByMe: true })

    expect(await store.toggleLike('stored-1')).toBe(true)
    expect(store.posts[0]).toMatchObject({ likes: 2, likedByMe: false })
    expect(apiPosts()[0]).toMatchObject({ likes: 2, likedByMe: false })
  })

  it('点赞数不会小于 0', async () => {
    seedApi([storedPost({ likes: 0, likedByMe: true })])
    const store = await createStore()

    await store.toggleLike('stored-1')

    expect(store.posts[0]!.likedByMe).toBe(false)
    expect(store.posts[0]!.likes).toBe(0)
  })

  it('未知动态返回 false', async () => {
    const store = await createStore()
    expect(await store.toggleLike('missing')).toBe(false)
  })

  it('点赞后影响统计、导航计数与热榜', async () => {
    seedApi([storedPost({ id: 'a', likes: 0 }), storedPost({ id: 'b', likes: 5 })])
    const store = await createStore()

    await store.toggleLike('a')

    expect(store.stats.likes).toBe(6)
    expect(store.navCounts.liked).toBe(1)
    expect(store.hotBoard.items[0]!.id).toBe('b')
    expect(store.hotBoard.items[1]!.likes).toBe(1)
  })

  it('同一动态连点只发出一次请求，不会重复计数', async () => {
    seedApi([storedPost({ likes: 2, likedByMe: false })])
    const store = await createStore()

    const results = await Promise.all([store.toggleLike('stored-1'), store.toggleLike('stored-1')])

    expect(results).toEqual([true, false])
    expect(store.posts[0]).toMatchObject({ likes: 3, likedByMe: true })
    expect(apiPosts()[0]).toMatchObject({ likes: 3, likedByMe: true })
  })

  it('网络失败时回滚点赞状态并返回 false', async () => {
    seedApi([storedPost({ likes: 2, likedByMe: false })])
    const store = await createStore()
    failNextRequests(1)

    expect(await store.toggleLike('stored-1')).toBe(false)
    expect(store.posts[0]).toMatchObject({ likes: 2, likedByMe: false })
    expect(store.apiAvailable).toBe(false)
  })
})

describe('收藏', () => {
  it('收藏与取消收藏同步状态与后端', async () => {
    seedApi([storedPost()])
    const store = await createStore()

    expect(await store.toggleFavorite('stored-1')).toBe(true)
    expect(store.posts[0]).toMatchObject({ favorited: true })
    expect(apiPosts()[0]).toMatchObject({ favorited: true })

    expect(await store.toggleFavorite('stored-1')).toBe(true)
    expect(store.posts[0]).toMatchObject({ favorited: false })
    expect(apiPosts()[0]).toMatchObject({ favorited: false })
  })

  it('未知动态返回 false', async () => {
    const store = await createStore()
    expect(await store.toggleFavorite('missing')).toBe(false)
  })

  it('同一动态连点只发出一次请求，状态不会错乱', async () => {
    seedApi([storedPost({ favorited: false })])
    const store = await createStore()

    const results = await Promise.all([
      store.toggleFavorite('stored-1'),
      store.toggleFavorite('stored-1'),
    ])

    expect(results).toEqual([true, false])
    expect(store.posts[0]).toMatchObject({ favorited: true })
    expect(apiPosts()[0]).toMatchObject({ favorited: true })
  })

  it('网络失败时回滚收藏状态并返回 false', async () => {
    seedApi([storedPost({ favorited: false })])
    const store = await createStore()
    failNextRequests(1)

    expect(await store.toggleFavorite('stored-1')).toBe(false)
    expect(store.posts[0]).toMatchObject({ favorited: false })
    expect(store.apiAvailable).toBe(false)
  })

  it('收藏影响导航计数与统计', async () => {
    seedApi([storedPost({ id: 'a' }), storedPost({ id: 'b', favorited: true })])
    const store = await createStore()

    expect(store.navCounts.favorites).toBe(1)
    expect(store.stats.favorites).toBe(1)

    await store.toggleFavorite('a')
    expect(store.navCounts.favorites).toBe(2)
    expect(store.stats.favorites).toBe(2)

    await store.toggleFavorite('b')
    expect(store.navCounts.favorites).toBe(1)
    expect(store.stats.favorites).toBe(1)
  })

  it('「我收藏的」视图只展示收藏内容，可与板块筛选叠加', async () => {
    seedApi(
      [
        storedPost({ id: 'fav-tech', favorited: true, topic: '科技' }),
        storedPost({ id: 'plain', topic: '科技' }),
        storedPost({ id: 'fav-life', favorited: true, topic: '生活' }),
      ],
      { id: 'user-me', name: '微波过客' },
    )
    const store = await createStore()

    store.setView('favorites')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['fav-tech', 'fav-life'])

    store.setTopic('科技')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['fav-tech'])
  })
})

describe('删除动态', () => {
  it('可以删除自己的动态并同步后端', async () => {
    seedApi([storedPost({ id: 'mine', authorId: 'me' }), storedPost({ id: 'other', authorId: 'other' })], {
      id: 'me',
      name: '我',
    })
    const store = await createStore()

    expect(await store.removePost('mine')).toBe('removed')
    expect(store.posts.map((post) => post.id)).toEqual(['other'])
    expect(apiPosts().map((post) => post.id)).toEqual(['other'])
  })

  it('不能删除他人的动态', async () => {
    seedApi([storedPost({ id: 'other', authorId: 'other' })], { id: 'me', name: '我' })
    const store = await createStore()

    expect(await store.removePost('other')).toBe('forbidden')
    expect(store.posts).toHaveLength(1)
  })

  it('删除不存在的动态返回 not-found', async () => {
    seedApi([storedPost()], { id: 'me', name: '我' })
    const store = await createStore()
    expect(await store.removePost('missing')).toBe('not-found')
  })

  it('网络失败时返回 network 且保留动态', async () => {
    seedApi([storedPost({ id: 'mine', authorId: 'me' })], { id: 'me', name: '我' })
    const store = await createStore()
    failNextRequests(1)

    expect(await store.removePost('mine')).toBe('network')
    expect(store.posts).toHaveLength(1)
  })
})

describe('修改昵称', () => {
  it('更新本人动态的作者名并同步后端', async () => {
    seedApi(
      [
        storedPost({ id: 'mine', authorId: 'me', author: '旧名字' }),
        storedPost({ id: 'other', authorId: 'other', author: '别人' }),
      ],
      { id: 'me', name: '旧名字' },
    )
    const store = await createStore()

    expect(await store.renameUser(' 新昵称 ')).toEqual({ ok: true })
    expect(store.user.name).toBe('新昵称')
    expect(store.posts.find((post) => post.id === 'mine')!.author).toBe('新昵称')
    expect(store.posts.find((post) => post.id === 'other')!.author).toBe('别人')
    expect(apiUser().name).toBe('新昵称')
    expect(apiPosts().find((post) => post.id === 'mine')!.author).toBe('新昵称')
  })

  it('空昵称被拒绝', async () => {
    seedApi([storedPost()], { id: 'me', name: '我' })
    const store = await createStore()

    expect(await store.renameUser('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(store.user.name).toBe('我')
  })

  it('网络失败时返回 network 且保留原昵称', async () => {
    seedApi([storedPost()], { id: 'me', name: '我' })
    const store = await createStore()
    failNextRequests(1)

    expect(await store.renameUser('新昵称')).toEqual({ ok: false, reason: 'network' })
    expect(store.user.name).toBe('我')
  })
})

describe('筛选、视图与统计', () => {
  beforeEach(async () => {
    seedApi(
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

  it('默认实时视图按时间倒序，可切换热门/我的/我赞过的', async () => {
    const store = await createStore()
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech', 'life', 'other'])

    store.setView('hot')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech', 'life', 'other'])

    store.setView('mine')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech', 'life'])

    store.setView('liked')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['life'])
  })

  it('热门视图按点赞降序，与时间顺序不同', async () => {
    seedApi([
      storedPost({ id: 'new-low', likes: 0, createdAt: NOW }),
      storedPost({ id: 'old-high', likes: 9, createdAt: NOW - 1000 }),
    ])
    const store = await createStore()

    store.setView('hot')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['old-high', 'new-low'])

    store.setView('live')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['new-low', 'old-high'])
  })

  it('板块筛选与搜索可叠加', async () => {
    const store = await createStore()
    store.setTopic('科技')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['tech'])

    store.setTopic('')
    store.setQuery('随笔')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['other'])
  })

  it('导航计数与统计随内容变化', async () => {
    const store = await createStore()

    expect(store.navCounts).toEqual({ live: 3, hot: 1, liked: 1, favorites: 0, mine: 2 })
    expect(store.stats).toEqual({
      posts: 3,
      likes: 5,
      favorites: 0,
      topics: TOPICS.length,
      quick: '本地社区 · 3 条动态 · 5 次点赞',
    })

    await store.toggleLike('other')
    expect(store.navCounts.hot).toBe(2)
    expect(store.stats.likes).toBe(6)
  })

  it('空数据时计数归零', async () => {
    seedApi([], { id: 'user-me', name: '我' })
    const store = await createStore()

    expect(store.navCounts).toEqual({ live: 0, hot: 0, liked: 0, favorites: 0, mine: 0 })
    expect(store.stats.likes).toBe(0)
  })
})

describe('热榜交互', () => {
  function seedMany(count: number) {
    seedApi(
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

  it('默认展示 6 条，展开后展示更多并可收起', async () => {
    seedMany(9)
    const store = await createStore()

    expect(store.hotBoard.items).toHaveLength(6)
    expect(store.hotBoard.canToggle).toBe(true)

    store.toggleHotExpanded()
    expect(store.hotExpanded).toBe(true)
    expect(store.hotBoard.items).toHaveLength(9)

    store.toggleHotExpanded()
    expect(store.hotBoard.items).toHaveLength(6)
  })

  it('换一换轮转榜单', async () => {
    seedMany(9)
    const store = await createStore()
    const before = store.hotBoard.items.map((post) => post.id)

    store.refreshHot()

    expect(store.hotOffset).toBe(1)
    expect(store.hotBoard.items.map((post) => post.id)).not.toEqual(before)
    expect(store.hotBoard.total).toBe(9)
  })

  it('内容不足 6 条时隐藏「查看更多」', async () => {
    seedMany(4)
    const store = await createStore()
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
