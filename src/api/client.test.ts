import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchPosts, fetchUser, isNetworkError } from '@/api/client'
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
})
