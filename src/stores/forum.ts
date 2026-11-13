import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  ApiError,
  createPost as apiCreatePost,
  deletePost as apiDeletePost,
  fetchPosts,
  fetchUser,
  setFavorite,
  setPostLike,
  updateUserName,
} from '@/api/client'
import { CHAR_LIMIT, DEFAULT_TOPIC, DEFAULT_USER_NAME, NAME_LIMIT, TOPICS } from '@/domain/constants'
import { buildHotBoard } from '@/domain/hot'
import {
  filterPosts,
  sortPostsForView,
  type Post,
  type Topic,
  type ViewMode,
} from '@/domain/posts'
import { clampChars, countChars } from '@/domain/text'
import type { User } from '@/domain/types'

export type PublishResult =
  | { ok: true; post: Post }
  | { ok: false; reason: 'empty' | 'too-long' | 'network' }

export type RenameResult = { ok: true } | { ok: false; reason: 'empty' | 'network' }

export type RemoveResult = 'removed' | 'forbidden' | 'not-found' | 'network'

export const useForumStore = defineStore('forum', () => {
  const posts = ref<Post[]>([])
  const user = ref<User>({ id: '', name: DEFAULT_USER_NAME })
  const view = ref<ViewMode>('live')
  const topic = ref<Topic | ''>('')
  const query = ref('')
  const composeTopic = ref<Topic>(DEFAULT_TOPIC)
  const hotOffset = ref(0)
  const hotExpanded = ref(false)
  const loading = ref(true)
  const apiAvailable = ref(true)

  /** 同一动态的点赞请求串行化，避免乱序响应覆盖状态 */
  const pendingLikes = new Set<string>()
  /** 同一动态的收藏请求串行化，避免乱序响应覆盖状态 */
  const pendingFavorites = new Set<string>()
  /** 加载期间是否已有写操作，避免迟到的 hydrate 覆盖本地结果 */
  let mutatedWhileLoading = false

  function markSuccess(): void {
    apiAvailable.value = true
  }

  function markFailure(error: unknown): void {
    const offline = error instanceof ApiError && (error.status === 0 || error.status >= 500)
    if (offline) apiAvailable.value = false
  }

  const stats = computed(() => {
    const likes = posts.value.reduce((sum, post) => sum + post.likes, 0)
    const favorites = posts.value.filter((post) => post.favorited).length
    return {
      posts: posts.value.length,
      likes,
      favorites,
      topics: TOPICS.length,
      quick: `本地社区 · ${posts.value.length} 条动态 · ${likes} 次点赞`,
    }
  })

  const navCounts = computed(() => ({
    live: posts.value.length,
    hot: posts.value.filter((post) => post.likes > 0).length,
    liked: posts.value.filter((post) => post.likedByMe).length,
    favorites: posts.value.filter((post) => post.favorited).length,
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

  /** 从后端拉取动态与当前身份；失败时保持空态并标记后端不可用 */
  async function hydrate(): Promise<void> {
    loading.value = true
    try {
      const [nextPosts, nextUser] = await Promise.all([fetchPosts(), fetchUser()])
      if (!mutatedWhileLoading) {
        posts.value = nextPosts
        user.value = nextUser
      }
      markSuccess()
    } catch (error) {
      markFailure(error)
    } finally {
      loading.value = false
    }
  }

  async function publish(content: string): Promise<PublishResult> {
    const text = String(content ?? '').trim()

    if (!text) return { ok: false, reason: 'empty' }
    if (countChars(text) > CHAR_LIMIT) return { ok: false, reason: 'too-long' }

    try {
      const post = await apiCreatePost({ content: text, topic: composeTopic.value })
      posts.value = [post, ...posts.value]
      mutatedWhileLoading = true
      markSuccess()

      view.value = 'live'
      topic.value = ''
      query.value = ''

      return { ok: true, post }
    } catch (error) {
      markFailure(error)
      return { ok: false, reason: 'network' }
    }
  }

  async function toggleLike(id: string): Promise<boolean> {
    if (pendingLikes.has(id)) return false

    const post = posts.value.find((item) => item.id === id)
    if (!post) return false

    const before = { likedByMe: post.likedByMe, likes: post.likes }
    const liked = !before.likedByMe
    post.likedByMe = liked
    post.likes = Math.max(0, before.likes + (liked ? 1 : -1))
    mutatedWhileLoading = true
    pendingLikes.add(id)

    try {
      Object.assign(post, await setPostLike(id, liked))
      markSuccess()
      return true
    } catch (error) {
      post.likedByMe = before.likedByMe
      post.likes = before.likes
      markFailure(error)
      return false
    } finally {
      pendingLikes.delete(id)
    }
  }

  async function toggleFavorite(id: string): Promise<boolean> {
    if (pendingFavorites.has(id)) return false

    const post = posts.value.find((item) => item.id === id)
    if (!post) return false

    const before = post.favorited
    post.favorited = !before
    mutatedWhileLoading = true
    pendingFavorites.add(id)

    try {
      Object.assign(post, await setFavorite(id, !before))
      markSuccess()
      return true
    } catch (error) {
      post.favorited = before
      markFailure(error)
      return false
    } finally {
      pendingFavorites.delete(id)
    }
  }

  async function removePost(id: string): Promise<RemoveResult> {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return 'not-found'
    if (post.authorId !== user.value.id) return 'forbidden'

    try {
      await apiDeletePost(id)
      posts.value = posts.value.filter((item) => item.id !== id)
      mutatedWhileLoading = true
      markSuccess()
      return 'removed'
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) return 'forbidden'
      if (error instanceof ApiError && error.status === 404) return 'not-found'
      markFailure(error)
      return 'network'
    }
  }

  async function renameUser(rawName: string): Promise<RenameResult> {
    const name = clampChars(String(rawName ?? '').trim(), NAME_LIMIT)
    if (!name) return { ok: false, reason: 'empty' }

    try {
      const nextUser = await updateUserName(name)
      user.value = nextUser
      posts.value.forEach((post) => {
        if (post.authorId === nextUser.id) post.author = nextUser.name
      })
      mutatedWhileLoading = true
      markSuccess()
      return { ok: true }
    } catch (error) {
      markFailure(error)
      return { ok: false, reason: 'network' }
    }
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

  void hydrate()

  return {
    posts,
    user,
    view,
    topic,
    query,
    composeTopic,
    hotOffset,
    hotExpanded,
    loading,
    apiAvailable,
    stats,
    navCounts,
    visiblePosts,
    hotBoard,
    hydrate,
    publish,
    toggleLike,
    toggleFavorite,
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
