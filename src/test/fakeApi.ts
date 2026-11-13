import { vi } from 'vitest'
import { CHAR_LIMIT, DEFAULT_USER_NAME, NAME_LIMIT } from '@/domain/constants'
import { createId } from '@/domain/id'
import { createSeedPosts, normalizePosts, normalizeTopic, type Post } from '@/domain/posts'
import { clampChars, countChars } from '@/domain/text'
import type { User } from '@/domain/types'

export const FAKE_USER: User = { id: 'user-me', name: DEFAULT_USER_NAME }

interface FakeResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

interface ApiState {
  posts: Post[]
  user: User
  failures: number
}

const state: ApiState = {
  posts: [],
  user: { ...FAKE_USER },
  failures: 0,
}

function respond(status: number, body?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input')
      return body
    },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }
}

function pathOf(input: unknown): string {
  const raw = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input)
  const path = raw.replace(/^https?:\/\/[^/]+/, '')
  return path.startsWith('/api') ? path.slice('/api'.length) : path
}

function readBody(init?: RequestInit): Record<string, unknown> {
  const raw = init?.body
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function handle(input: unknown, init?: RequestInit): Promise<FakeResponse> {
  if (state.failures > 0) {
    state.failures -= 1
    throw new TypeError('fetch failed')
  }

  const method = (init?.method ?? 'GET').toUpperCase()
  const path = pathOf(input)
  const body = readBody(init)

  if (path === '/posts' && method === 'GET') {
    const posts = state.posts.slice().sort((left, right) => right.createdAt - left.createdAt)
    return respond(200, { posts })
  }

  if (path === '/posts' && method === 'POST') {
    const rawContent = body.content
    if (typeof rawContent !== 'string') return respond(400, { error: 'invalid-body' })

    const content = rawContent.trim()
    if (!content) return respond(400, { error: 'content-empty' })
    if (countChars(content) > CHAR_LIMIT) return respond(400, { error: 'content-too-long' })

    const post: Post = {
      id: createId(),
      authorId: state.user.id,
      author: state.user.name,
      topic: normalizeTopic(body.topic),
      content,
      createdAt: Date.now(),
      likes: 0,
      likedByMe: false,
    }
    state.posts = [post, ...state.posts]
    return respond(201, { post })
  }

  const postMatch = /^\/posts\/([^/]+)$/.exec(path)
  if (postMatch && method === 'DELETE') {
    const id = decodeURIComponent(postMatch[1] as string)
    const target = state.posts.find((post) => post.id === id)
    if (!target) return respond(404, { error: 'not-found' })
    if (target.authorId !== state.user.id) return respond(403, { error: 'forbidden' })
    state.posts = state.posts.filter((post) => post.id !== id)
    return respond(204)
  }

  const likeMatch = /^\/posts\/([^/]+)\/like$/.exec(path)
  if (likeMatch && method === 'PUT') {
    const id = decodeURIComponent(likeMatch[1] as string)
    const target = state.posts.find((post) => post.id === id)
    if (!target) return respond(404, { error: 'not-found' })
    if (typeof body.liked !== 'boolean') return respond(400, { error: 'invalid-body' })
    if (target.likedByMe !== body.liked) {
      target.likedByMe = body.liked
      target.likes = Math.max(0, target.likes + (body.liked ? 1 : -1))
    }
    return respond(200, { post: target })
  }

  if (path === '/user' && method === 'GET') return respond(200, { user: state.user })

  if (path === '/user' && method === 'PATCH') {
    const rawName = body.name
    if (typeof rawName !== 'string') return respond(400, { error: 'invalid-body' })
    const name = clampChars(rawName.trim(), NAME_LIMIT)
    if (!name) return respond(400, { error: 'name-empty' })

    state.user = { ...state.user, name }
    state.posts = state.posts.map((post) =>
      post.authorId === state.user.id ? { ...post, author: name } : post,
    )
    return respond(200, { user: state.user })
  }

  return respond(404, { error: 'not-found' })
}

/** 安装内存假后端：默认播种 3 条示例动态，当前用户 user-me */
export function installFakeApi(seed: { posts?: Post[]; user?: User } = {}): void {
  state.posts = normalizePosts(seed.posts ?? createSeedPosts())
  state.user = { ...(seed.user ?? FAKE_USER) }
  state.failures = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown, init?: RequestInit) => handle(input, init)),
  )
}

/** 写入假后端内存（替代原 seedStorage）；不传 user 时保留当前用户 */
export function seedApi(posts: Post[] | null, user: User | null = null): void {
  if (posts) state.posts = normalizePosts(posts)
  if (user) state.user = { ...user }
  state.failures = 0
}

/** 让接下来 N 次请求抛网络错误（hydrate 并行两次请求） */
export function failNextRequests(times = 1): void {
  state.failures = times
}

/** 断言用：读取假后端当前内存（替代原 readStoredPosts） */
export function apiPosts(): Post[] {
  return state.posts
}

export function apiUser(): User {
  return state.user
}
