export const TOPICS = ['随笔', '生活', '科技', '心情'] as const

export type Topic = (typeof TOPICS)[number]

export type ViewMode = 'live' | 'hot' | 'liked' | 'mine'

export interface Post {
  id: string
  authorId: string
  author: string
  topic: Topic
  content: string
  createdAt: number
  likes: number
  likedByMe: boolean
  /** 收藏状态；服务端始终输出，旧数据可缺省视为未收藏 */
  favorited?: boolean
}

export interface User {
  id: string
  name: string
}
