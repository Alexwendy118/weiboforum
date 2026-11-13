import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  CHAR_LIMIT,
  DEFAULT_TOPIC,
  DEFAULT_USER_NAME,
  NAME_LIMIT,
  STORAGE_KEYS,
  TOPICS,
} from '@/domain/constants'
import { buildHotBoard } from '@/domain/hot'
import { createId } from '@/domain/id'
import {
  createSeedPosts,
  filterPosts,
  normalizePosts,
  sortPostsForView,
  type Post,
  type Topic,
  type ViewMode,
} from '@/domain/posts'
import { clampChars, countChars } from '@/domain/text'
import type { User } from '@/domain/types'
import { readJSON, resolveStorage, writeJSON } from '@/storage/localStore'

export type PublishResult =
  | { ok: true; post: Post }
  | { ok: false; reason: 'empty' | 'too-long' }

export type RenameResult = { ok: true } | { ok: false; reason: 'empty' }

export type RemoveResult = 'removed' | 'forbidden' | 'not-found'

interface StoredUser {
  id?: unknown
  name?: unknown
}

export const useForumStore = defineStore('forum', () => {
  const storage = resolveStorage()

  const posts = ref<Post[]>([])
  const user = ref<User>({ id: '', name: DEFAULT_USER_NAME })
  const view = ref<ViewMode>('live')
  const topic = ref<Topic | ''>('')
  const query = ref('')
  const composeTopic = ref<Topic>(DEFAULT_TOPIC)
  const hotOffset = ref(0)
  const hotExpanded = ref(false)
  const storageAvailable = ref(true)

  const stats = computed(() => {
    const likes = posts.value.reduce((sum, post) => sum + post.likes, 0)
    return {
      posts: posts.value.length,
      likes,
      topics: TOPICS.length,
      quick: `本地社区 · ${posts.value.length} 条动态 · ${likes} 次点赞`,
    }
  })

  const navCounts = computed(() => ({
    live: posts.value.length,
    hot: posts.value.filter((post) => post.likes > 0).length,
    liked: posts.value.filter((post) => post.likedByMe).length,
    mine: posts.value.filter((post) => post.authorId === user.value.id).length,
  }))

  const visiblePosts = computed(() => {
    const filtered = filterPosts(posts.value, {
      view: view.value,
      topic: topic.value,
      query: query.value,
      userId: user.value.id,
    })
    return sortPostsForView(filtered, view.value)
  })

  const hotBoard = computed(() =>
    buildHotBoard(posts.value, {
      offset: hotOffset.value,
      expanded: hotExpanded.value,
    }),
  )

  function persistPosts(): void {
    if (!writeJSON(storage, STORAGE_KEYS.posts, posts.value)) storageAvailable.value = false
  }

  function persistUser(): void {
    if (!writeJSON(storage, STORAGE_KEYS.user, user.value)) storageAvailable.value = false
  }

  function load(): void {
    const storedPosts = readJSON<unknown>(storage, STORAGE_KEYS.posts)
    if (storedPosts === null) {
      posts.value = createSeedPosts()
      persistPosts()
    } else {
      posts.value = normalizePosts(storedPosts)
    }

    const storedUser = readJSON<StoredUser>(storage, STORAGE_KEYS.user)
    const storedName =
      storedUser && typeof storedUser.name === 'string' ? storedUser.name.trim() : ''

    if (storedUser && storedName) {
      user.value = {
        id:
          typeof storedUser.id === 'string' && storedUser.id ? storedUser.id : createId(),
        name: clampChars(storedName, NAME_LIMIT),
      }
    } else {
      user.value = { id: createId(), name: DEFAULT_USER_NAME }
    }

    if (!storedUser || storedUser.id !== user.value.id) persistUser()
  }

  function publish(content: string): PublishResult {
    const text = String(content ?? '').trim()

    if (!text) return { ok: false, reason: 'empty' }
    if (countChars(text) > CHAR_LIMIT) return { ok: false, reason: 'too-long' }

    const post: Post = {
      id: createId(),
      authorId: user.value.id,
      author: user.value.name,
      topic: composeTopic.value,
      content: text,
      createdAt: Date.now(),
      likes: 0,
      likedByMe: false,
    }

    posts.value = [post, ...posts.value]
    persistPosts()

    view.value = 'live'
    topic.value = ''
    query.value = ''

    return { ok: true, post }
  }

  function toggleLike(id: string): boolean {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return false

    post.likedByMe = !post.likedByMe
    post.likes = Math.max(0, post.likes + (post.likedByMe ? 1 : -1))
    persistPosts()
    return true
  }

  function removePost(id: string): RemoveResult {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return 'not-found'
    if (post.authorId !== user.value.id) return 'forbidden'

    posts.value = posts.value.filter((item) => item.id !== id)
    persistPosts()
    return 'removed'
  }

  function renameUser(rawName: string): RenameResult {
    const name = clampChars(String(rawName ?? '').trim(), NAME_LIMIT)
    if (!name) return { ok: false, reason: 'empty' }

    user.value = { ...user.value, name }
    posts.value.forEach((post) => {
      if (post.authorId === user.value.id) post.author = name
    })

    persistUser()
    persistPosts()
    return { ok: true }
  }

  function setView(next: ViewMode): void {
    view.value = next
  }

  function setTopic(next: Topic | ''): void {
    topic.value = next
  }

  function setQuery(next: string): void {
    query.value = next
  }

  function setComposeTopic(next: Topic): void {
    composeTopic.value = next
  }

  function refreshHot(): void {
    hotOffset.value += 1
  }

  function toggleHotExpanded(): void {
    hotExpanded.value = !hotExpanded.value
  }

  function findPost(id: string): Post | undefined {
    return posts.value.find((item) => item.id === id)
  }

  load()

  return {
    posts,
    user,
    view,
    topic,
    query,
    composeTopic,
    hotOffset,
    hotExpanded,
    storageAvailable,
    stats,
    navCounts,
    visiblePosts,
    hotBoard,
    publish,
    toggleLike,
    removePost,
    renameUser,
    setView,
    setTopic,
    setQuery,
    setComposeTopic,
    refreshHot,
    toggleHotExpanded,
    findPost,
  }
})
