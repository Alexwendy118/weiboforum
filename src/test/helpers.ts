import { createPinia, setActivePinia, type Pinia } from 'pinia'
import type { Post } from '@/domain/types'

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
    favorited: false,
    ...overrides,
  }
}

export {
  apiPosts,
  apiUser,
  failNextRequests,
  installFakeApi,
  seedApi,
} from './fakeApi'

/** 每个测试用独立的 Pinia 实例，避免 store 之间串状态 */
export function freshPinia(): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}
