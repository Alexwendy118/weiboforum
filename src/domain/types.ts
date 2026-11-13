export const TOPICS = ['随笔', '生活', '科技', '心情'] as const

export type Topic = (typeof TOPICS)[number]

export type ViewMode = 'live' | 'hot' | 'liked' | 'favorites' | 'mine'

export interface Post {
  id: string
  authorId: string
  author: string
  topic: Topic
  content: string
  createdAt: number
  likes: number
  likedByMe: boolean
  favorited: boolean
}

export interface User {
  id: string
  name: string
}
