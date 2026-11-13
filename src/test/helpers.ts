import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { STORAGE_KEYS } from '@/domain/constants'
import type { Post, User } from '@/domain/types'

export const TEST_NOW = new Date(2026, 2, 5, 12, 0, 0).getTime()

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-1',
    authorId: 'user-me',
    author: '微波过客',
    topic: '随笔',
    content: '此刻的想法',
    createdAt: Date.now(),
    likes: 0,
    likedByMe: false,
    ...overrides,
  }
}

export function seedStorage(posts: Post[] | null, user: User | null = null): void {
  if (posts) localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts))
  if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
}

/** 每个测试用独立的 Pinia 实例，避免 store 之间串状态 */
export function freshPinia(): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}
