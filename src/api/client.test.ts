import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchPosts, fetchUser, isNetworkError, setFavorite } from '@/api/client'
import { makePost } from '@/test/helpers'

function stubResponse(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API 客户端', () => {
  it('解析动态列表并对脏数据做规范化', async () => {
    stubResponse(200, { posts: [makePost({ id: 'p-1', likes: -3 })] })

    const posts = await fetchPosts()

    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ id: 'p-1', likes: 0 })
  })

  it('后端 200 但结构不符时抛 invalid-response，而不是静默当成空列表', async () => {
    stubResponse(200, { items: [] })

    await expect(fetchPosts()).rejects.toMatchObject({ status: 200, code: 'invalid-response' })
  })

  it('身份缺少字段时抛 invalid-response', async () => {
    stubResponse(200, { user: { name: '无 id' } })

    await expect(fetchUser()).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('非 2xx 抛带后端错误码的 ApiError', async () => {
    stubResponse(400, { error: 'content-empty' })

    await expect(fetchPosts()).rejects.toMatchObject({ status: 400, code: 'content-empty' })
  })

  it('网络异常归一为 status 0 的 ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    const error = await fetchPosts().catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(ApiError)
    expect(isNetworkError(error)).toBe(true)
  })

  it('setFavorite 发送 PUT 收藏请求并解析返回的动态', async () => {
    const calls: Array<{ input: unknown; init?: RequestInit }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: RequestInit) => {
        calls.push({ input, init })
        return {
          ok: true,
          status: 200,
          json: async () => ({ post: makePost({ id: 'p-9', favorited: true }) }),
        }
      }),
    )

    const post = await setFavorite('p-9', true)

    expect(post).toMatchObject({ id: 'p-9', favorited: true })
    expect(String(calls[0]!.input)).toBe('/api/posts/p-9/favorite')
    expect(calls[0]!.init).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ favorited: true })
  })

  it('setFavorite 非 2xx 抛带后端错误码的 ApiError', async () => {
    stubResponse(400, { error: 'invalid-body' })
    await expect(setFavorite('p-1', true)).rejects.toMatchObject({
      status: 400,
      code: 'invalid-body',
    })

    stubResponse(404, { error: 'not-found' })
    await expect(setFavorite('missing', false)).rejects.toMatchObject({
      status: 404,
      code: 'not-found',
    })
  })

  it('setFavorite 幂等：重复设置同一状态返回相同的动态', async () => {
    stubResponse(200, { post: makePost({ id: 'p-1', favorited: true }) })

    const first = await setFavorite('p-1', true)
    const second = await setFavorite('p-1', true)

    expect(second).toEqual(first)
  })
})
