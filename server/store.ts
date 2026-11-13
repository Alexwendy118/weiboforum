import { DEFAULT_USER_NAME, NAME_LIMIT } from '../src/domain/constants'
import { createId } from '../src/domain/id'
import { createSeedPosts, normalizeTopic } from '../src/domain/posts'
import { clampChars } from '../src/domain/text'
import type { Post, Topic, User } from '../src/domain/types'

export interface CreatePostInput {
  content: string
  topic?: Topic
}

export type DeleteResult = { ok: true; post: Post } | { ok: false; reason: 'not-found' | 'forbidden' }

export type LikeResult = { ok: true; post: Post } | { ok: false; reason: 'not-found' }

export type FavoritedResult = { ok: true; post: Post } | { ok: false; reason: 'not-found' }

export interface MemoryStore {
  listPosts(): Post[]
  createPost(input: CreatePostInput): Post
  deletePost(id: string): DeleteResult
  setLike(id: string, liked: boolean): LikeResult
  setFavorite(id: string, favorited: boolean): FavoritedResult
  getUser(): User
  renameUser(name: string): User
}

export interface MemoryStoreOptions {
  /** 可注入时钟，便于测试固定时间 */
  now?: () => number
}

/**
 * 单用户的内存微社区数据源。
 * 每次启动重新播种示例数据，进程结束即丢失，不写磁盘。
 */
export function createMemoryStore(options: MemoryStoreOptions = {}): MemoryStore {
  const clock = options.now ?? Date.now

  let posts: Post[] = createSeedPosts(clock()).map((post, index) => ({
    ...post,
    // 播种数据中让部分示例动态处于已收藏状态，方便前端展示两种态
    favorited: index % 2 === 1,
  }))
  let user: User = { id: createId(), name: DEFAULT_USER_NAME }

  function findPost(id: string): Post | undefined {
    return posts.find((post) => post.id === id)
  }

  return {
    /** 全量动态，按发布时间倒序（最新在前） */
    listPosts(): Post[] {
      return posts.slice().sort((left, right) => right.createdAt - left.createdAt)
    },

    createPost(input: CreatePostInput): Post {
      const topic: Topic = normalizeTopic(input.topic)
      const post: Post = {
        id: createId(),
        authorId: user.id,
        author: user.name,
        topic,
        content: input.content.trim(),
        createdAt: clock(),
        likes: 0,
        likedByMe: false,
        favorited: false,
      }
      posts = [post, ...posts]
      return post
    },

    deletePost(id: string): DeleteResult {
      const post = findPost(id)
      if (!post) return { ok: false, reason: 'not-found' }
      if (post.authorId !== user.id) return { ok: false, reason: 'forbidden' }

      posts = posts.filter((item) => item.id !== id)
      return { ok: true, post }
    },

    setLike(id: string, liked: boolean): LikeResult {
      const post = findPost(id)
      if (!post) return { ok: false, reason: 'not-found' }

      if (post.likedByMe !== liked) {
        post.likedByMe = liked
        post.likes = Math.max(0, post.likes + (liked ? 1 : -1))
      }
      return { ok: true, post }
    },

    setFavorite(id: string, favorited: boolean): FavoritedResult {
      const post = findPost(id)
      if (!post) return { ok: false, reason: 'not-found' }

      post.favorited = favorited
      return { ok: true, post }
    },

    getUser(): User {
      return { ...user }
    },

    renameUser(name: string): User {
      const nextName = clampChars(name.trim(), NAME_LIMIT) || DEFAULT_USER_NAME
      user = { ...user, name: nextName }
      posts = posts.map((post) =>
        post.authorId === user.id ? { ...post, author: nextName } : post,
      )
      return { ...user }
    },
  }
}
