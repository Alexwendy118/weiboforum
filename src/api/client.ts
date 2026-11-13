import { DEFAULT_USER_NAME, NAME_LIMIT } from '@/domain/constants'
import { normalizePosts, type Post } from '@/domain/posts'
import { clampChars } from '@/domain/text'
import type { Topic, User } from '@/domain/types'

const API_BASE = '/api'
const JSON_HEADERS = { 'content-type': 'application/json' }
const REQUEST_TIMEOUT = 8000

/** 非 2xx 或网络异常统一抛这个错误：status=0 表示网络层失败 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(`api error ${status}: ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** 网络层失败（断网 / 超时），区别于服务端返回的业务错误 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0
}

function isErrorBody(value: unknown): value is { error: string } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as { error?: unknown }).error === 'string'
  )
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = init.signal ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT) : undefined

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init.signal ?? controller?.signal,
      headers: init.body === undefined ? undefined : JSON_HEADERS,
    })
  } catch {
    throw new ApiError(0, controller?.signal.aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const payload = await readJson(response)
    throw new ApiError(
      response.status,
      isErrorBody(payload) ? payload.error : `http-${response.status}`,
    )
  }

  if (response.status === 204) return undefined as unknown as T
  return (await readJson(response)) as T
}

function asRecord(value: unknown, status = 200): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new ApiError(status, 'invalid-response')
  return value as Record<string, unknown>
}

function toPost(raw: unknown): Post {
  const [post] = normalizePosts([raw])
  if (!post) throw new ApiError(200, 'invalid-response')
  return post
}

function toUser(raw: unknown): User {
  const record = asRecord(raw)
  if (typeof record.id !== 'string' || !record.id || typeof record.name !== 'string') {
    throw new ApiError(200, 'invalid-response')
  }
  return {
    id: record.id,
    name: clampChars(record.name.trim(), NAME_LIMIT) || DEFAULT_USER_NAME,
  }
}

export async function fetchPosts(): Promise<Post[]> {
  const payload = asRecord(await request<unknown>('/posts'))
  if (!Array.isArray(payload.posts)) throw new ApiError(200, 'invalid-response')
  return normalizePosts(payload.posts)
}

export async function fetchUser(): Promise<User> {
  const payload = asRecord(await request<unknown>('/user'))
  return toUser(payload.user)
}

export async function createPost(input: { content: string; topic: Topic }): Promise<Post> {
  const payload = asRecord(
    await request<unknown>('/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
  return toPost(payload.post)
}

export async function deletePost(id: string): Promise<void> {
  await request<void>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function setPostLike(id: string, liked: boolean): Promise<Post> {
  const payload = asRecord(
    await request<unknown>(`/posts/${encodeURIComponent(id)}/like`, {
      method: 'PUT',
      body: JSON.stringify({ liked }),
    }),
  )
  return toPost(payload.post)
}

export async function updateUserName(name: string): Promise<User> {
  const payload = asRecord(
    await request<unknown>('/user', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  )
  return toUser(payload.user)
}
