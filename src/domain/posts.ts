import { DEFAULT_TOPIC, TOPICS } from './constants'
import { createId } from './id'
import type { Post, Topic, ViewMode } from './types'

export type { Post, Topic, ViewMode } from './types'

export interface PostFilter {
  view: ViewMode
  topic: Topic | ''
  query: string
  userId: string
}

/** 未知板块统一回落为默认板块，兼容旧版本数据 */
export function normalizeTopic(value: unknown): Topic {
  return TOPICS.includes(value as Topic) ? (value as Topic) : DEFAULT_TOPIC
}

/**
 * 把接口返回的任意内容整理成合法的动态列表：
 * 无效条目丢弃，缺失字段补默认值，非法数值修正。
 */
export function normalizePosts(raw: unknown): Post[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && typeof (item as Post).content === 'string' && Boolean((item as Post).content.trim()),
    )
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : createId(),
      authorId: typeof item.authorId === 'string' ? item.authorId : 'unknown',
      author:
        typeof item.author === 'string' && item.author.trim() ? item.author.trim() : '匿名用户',
      topic: normalizeTopic(item.topic),
      content: item.content as string,
      createdAt: Number(item.createdAt) || Date.now(),
      likes: Math.max(0, Number(item.likes) || 0),
      likedByMe: Boolean(item.likedByMe),
    }))
}

/** 首次访问写入的示例内容，让时间线不是空的 */
export function createSeedPosts(now: number = Date.now()): Post[] {
  const seeds = [
    {
      author: '微波小厨',
      topic: '生活' as Topic,
      content:
        '新的一天，先把水烧上。热水冲开的茶叶，比任何提醒都更像一句“开始吧”。',
      minutes: 6,
      likes: 12,
    },
    {
      author: '深夜放映员',
      topic: '心情' as Topic,
      content:
        '凌晨的街道只有便利店还亮着。买了一瓶温热的豆奶，站在门口喝完，忽然觉得这座城市也挺温柔。',
      minutes: 74,
      likes: 28,
    },
    {
      author: '图层收藏家',
      topic: '随笔' as Topic,
      content:
        '今日小结：\n1. 把桌面清空了一次\n2. 走了 8200 步\n3. 认真吃完了一顿饭\n微小但确切的三件事。',
      minutes: 320,
      likes: 7,
    },
  ]

  return seeds.map((seed, index) => ({
    id: `seed-${index + 1}`,
    authorId: `seed-author-${index + 1}`,
    author: seed.author,
    topic: seed.topic,
    content: seed.content,
    createdAt: now - seed.minutes * 60_000,
    likes: seed.likes,
    likedByMe: false,
  }))
}

/** 视图 + 板块 + 搜索词三个条件的叠加筛选 */
export function filterPosts(posts: readonly Post[], filter: PostFilter): Post[] {
  const query = filter.query.trim().toLowerCase()

  return posts.filter((post) => {
    if (filter.view === 'mine' && post.authorId !== filter.userId) return false
    if (filter.view === 'liked' && !post.likedByMe) return false
    if (filter.topic && normalizeTopic(post.topic) !== filter.topic) return false
    if (!query) return true
    return (
      post.content.toLowerCase().includes(query) ||
      post.author.toLowerCase().includes(query) ||
      normalizeTopic(post.topic).toLowerCase().includes(query)
    )
  })
}

/** 热门视图按点赞数排序，其余视图按发布时间倒序 */
export function sortPostsForView(posts: readonly Post[], view: ViewMode): Post[] {
  return posts.slice().sort((left, right) => {
    if (view === 'hot' && right.likes !== left.likes) return right.likes - left.likes
    return right.createdAt - left.createdAt
  })
}

export function avatarSeedOf(item: { authorId: string; author: string }): string {
  return `${item.authorId}${item.author}`
}
