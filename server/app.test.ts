// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CHAR_LIMIT, DEFAULT_USER_NAME, NAME_LIMIT } from '../src/domain/constants'
import { createApp } from './app'
import { createMemoryStore } from './store'

const POST_FIELDS = ['author', 'authorId', 'content', 'createdAt', 'id', 'likedByMe', 'likes', 'topic']

function setup() {
  const store = createMemoryStore()
  const app = createApp(store)
  return { store, app }
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }
}

async function createOwnPost(app: ReturnType<typeof setup>['app'], content = '我的一条动态') {
  const response = await app.request('/api/posts', jsonRequest('POST', { content, topic: '随笔' }))
  expect(response.status).toBe(201)
  const payload = (await response.json()) as { post: { id: string } }
  return payload.post
}

describe('GET /api/health', () => {
  it('返回服务健康状态', async () => {
    const { app } = setup()
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})

describe('GET /api/posts', () => {
  it('首次启动播种 3 条示例动态，按发布时间倒序', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts')
    const payload = (await response.json()) as { posts: Array<{ id: string; createdAt: number }> }

    expect(response.status).toBe(200)
    expect(payload.posts).toHaveLength(3)
    const times = payload.posts.map((post) => post.createdAt)
    expect(times).toEqual([...times].sort((left, right) => right - left))
  })

  it('每条动态包含完整字段', async () => {
    const { app } = setup()
    const payload = (await (await app.request('/api/posts')).json()) as {
      posts: Array<Record<string, unknown>>
    }

    for (const post of payload.posts) {
      expect(Object.keys(post).sort()).toEqual(POST_FIELDS)
      expect(typeof post.id).toBe('string')
      expect(typeof post.authorId).toBe('string')
      expect(typeof post.author).toBe('string')
      expect(typeof post.content).toBe('string')
      expect(typeof post.createdAt).toBe('number')
      expect(typeof post.likes).toBe('number')
      expect(typeof post.likedByMe).toBe('boolean')
    }
  })

  it('不同实例的数据互相隔离', async () => {
    const first = setup()
    const second = setup()
    await createOwnPost(first.app)

    const firstPayload = (await (await first.app.request('/api/posts')).json()) as {
      posts: unknown[]
    }
    const secondPayload = (await (await second.app.request('/api/posts')).json()) as {
      posts: unknown[]
    }

    expect(firstPayload.posts).toHaveLength(4)
    expect(secondPayload.posts).toHaveLength(3)
  })
})

describe('POST /api/posts', () => {
  it('创建成功后置顶返回，作者为当前用户，点赞从 0 开始', async () => {
    const { app, store } = setup()
    const response = await app.request(
      '/api/posts',
      jsonRequest('POST', { content: '  新动态  ', topic: '科技' }),
    )
    const payload = (await response.json()) as { post: Record<string, unknown> }

    expect(response.status).toBe(201)
    expect(payload.post).toMatchObject({
      content: '新动态',
      topic: '科技',
      author: DEFAULT_USER_NAME,
      authorId: store.getUser().id,
      likes: 0,
      likedByMe: false,
    })
    expect(payload.post.id).toEqual(expect.any(String))

    const list = (await (await app.request('/api/posts')).json()) as {
      posts: Array<{ id: string }>
    }
    expect(list.posts[0]!.id).toBe(payload.post.id)
  })

  it('空白内容返回 400 content-empty', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts', jsonRequest('POST', { content: '   ' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'content-empty' })
  })

  it('超过 140 字返回 400 content-too-long', async () => {
    const { app } = setup()
    const response = await app.request(
      '/api/posts',
      jsonRequest('POST', { content: '字'.repeat(CHAR_LIMIT + 1) }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'content-too-long' })
  })

  it('正好 140 字可以发布', async () => {
    const { app } = setup()
    const response = await app.request(
      '/api/posts',
      jsonRequest('POST', { content: '字'.repeat(CHAR_LIMIT) }),
    )

    expect(response.status).toBe(201)
  })

  it('emoji 按字符数计算上限', async () => {
    const { app } = setup()
    const response = await app.request(
      '/api/posts',
      jsonRequest('POST', { content: '🍵'.repeat(CHAR_LIMIT) }),
    )
    const over = await app.request(
      '/api/posts',
      jsonRequest('POST', { content: '🍵'.repeat(CHAR_LIMIT + 1) }),
    )

    expect(response.status).toBe(201)
    expect(over.status).toBe(400)
  })

  it('非法板块与缺失板块都回落为随笔', async () => {
    const { app } = setup()
    const invalid = (await (
      await app.request('/api/posts', jsonRequest('POST', { content: 'A', topic: '不存在' }))
    ).json()) as { post: { topic: string } }
    const missing = (await (
      await app.request('/api/posts', jsonRequest('POST', { content: 'B' }))
    ).json()) as { post: { topic: string } }

    expect(invalid.post.topic).toBe('随笔')
    expect(missing.post.topic).toBe('随笔')
  })

  it('超大请求体返回 413 payload-too-large', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content: '正常内容' }),
      headers: { 'content-type': 'application/json', 'content-length': '70000' },
    })

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'payload-too-large' })
  })

  it('非法 JSON 与非法字段类型返回 400 invalid-body', async () => {
    const { app } = setup()
    const broken = await app.request('/api/posts', {
      method: 'POST',
      body: '{ not json',
      headers: { 'content-type': 'application/json' },
    })
    const wrongType = await app.request('/api/posts', jsonRequest('POST', { content: 123 }))

    expect(broken.status).toBe(400)
    expect(await broken.json()).toEqual({ error: 'invalid-body' })
    expect(wrongType.status).toBe(400)
    expect(await wrongType.json()).toEqual({ error: 'invalid-body' })
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除他人动态返回 403 forbidden', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts/seed-1', { method: 'DELETE' })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'forbidden' })
  })

  it('删除不存在的动态返回 404 not-found', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts/does-not-exist', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not-found' })
  })

  it('删除自己的动态返回 204 且不再出现在列表', async () => {
    const { app } = setup()
    const post = await createOwnPost(app)

    const response = await app.request(`/api/posts/${post.id}`, { method: 'DELETE' })
    const list = (await (await app.request('/api/posts')).json()) as {
      posts: Array<{ id: string }>
    }

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(list.posts.map((item) => item.id)).not.toContain(post.id)
  })
})

describe('PUT /api/posts/:id/like', () => {
  it('点赞使数量加一并置为已赞', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts/seed-1/like', jsonRequest('PUT', { liked: true }))
    const payload = (await response.json()) as { post: { likes: number; likedByMe: boolean } }

    expect(response.status).toBe(200)
    expect(payload.post).toMatchObject({ likes: 13, likedByMe: true })
  })

  it('重复点赞幂等，不重复累加', async () => {
    const { app } = setup()
    await app.request('/api/posts/seed-1/like', jsonRequest('PUT', { liked: true }))
    const response = await app.request('/api/posts/seed-1/like', jsonRequest('PUT', { liked: true }))
    const payload = (await response.json()) as { post: { likes: number } }

    expect(payload.post.likes).toBe(13)
  })

  it('取消点赞减一且不会小于 0', async () => {
    const { app } = setup()
    const post = await createOwnPost(app)
    await app.request(`/api/posts/${post.id}/like`, jsonRequest('PUT', { liked: true }))

    const first = (await (
      await app.request(`/api/posts/${post.id}/like`, jsonRequest('PUT', { liked: false }))
    ).json()) as { post: { likes: number; likedByMe: boolean } }
    const second = (await (
      await app.request(`/api/posts/${post.id}/like`, jsonRequest('PUT', { liked: false }))
    ).json()) as { post: { likes: number; likedByMe: boolean } }

    expect(first.post).toMatchObject({ likes: 0, likedByMe: false })
    expect(second.post).toMatchObject({ likes: 0, likedByMe: false })
  })

  it('缺少或非法 liked 返回 400 invalid-body', async () => {
    const { app } = setup()
    const missing = await app.request('/api/posts/seed-1/like', jsonRequest('PUT', {}))
    const wrong = await app.request('/api/posts/seed-1/like', jsonRequest('PUT', { liked: 'yes' }))

    expect(await missing.json()).toEqual({ error: 'invalid-body' })
    expect(await wrong.json()).toEqual({ error: 'invalid-body' })
  })

  it('未知动态返回 404 not-found', async () => {
    const { app } = setup()
    const response = await app.request('/api/posts/nope/like', jsonRequest('PUT', { liked: true }))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not-found' })
  })
})

describe('用户接口', () => {
  it('GET /api/user 返回当前身份', async () => {
    const { app } = setup()
    const payload = (await (await app.request('/api/user')).json()) as {
      user: { id: string; name: string }
    }

    expect(payload.user.id).toEqual(expect.any(String))
    expect(payload.user.name).toBe(DEFAULT_USER_NAME)
  })

  it('空白昵称返回 400 name-empty', async () => {
    const { app } = setup()
    const response = await app.request('/api/user', jsonRequest('PATCH', { name: '   ' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'name-empty' })
  })

  it('改名同步更新本人动态的作者，不影响他人', async () => {
    const { app } = setup()
    const mine = await createOwnPost(app)

    const response = await app.request('/api/user', jsonRequest('PATCH', { name: ' 新昵称 ' }))
    const payload = (await response.json()) as { user: { name: string } }
    const list = (await (await app.request('/api/posts')).json()) as {
      posts: Array<{ id: string; author: string }>
    }

    expect(payload.user.name).toBe('新昵称')
    expect(list.posts.find((post) => post.id === mine.id)!.author).toBe('新昵称')
    expect(list.posts.find((post) => post.id === 'seed-1')!.author).toBe('微波小厨')
  })

  it('昵称按字符截断为 12 个字符', async () => {
    const { app } = setup()
    const payload = (await (
      await app.request('/api/user', jsonRequest('PATCH', { name: '一二三四五六七八九十十一十二十三' }))
    ).json()) as { user: { name: string } }

    expect(Array.from(payload.user.name)).toHaveLength(NAME_LIMIT)
    expect(payload.user.name).toBe('一二三四五六七八九十十一')
  })
})

describe('未知路由', () => {
  it('未匹配的 /api/* 返回 404 not-found', async () => {
    const { app } = setup()
    const response = await app.request('/api/nope')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not-found' })
  })
})
