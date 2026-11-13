import { Hono, type Context } from 'hono'
import { CHAR_LIMIT } from '../src/domain/constants'
import { normalizeTopic } from '../src/domain/posts'
import { countChars } from '../src/domain/text'
import { createMemoryStore, type MemoryStore } from './store'

type JsonRecord = Record<string, unknown>

type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: 'invalid-body' | 'payload-too-large' }

const MAX_BODY_BYTES = 64 * 1024

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function readJsonBody(c: Context): Promise<BodyResult> {
  const length = Number(c.req.header('content-length') ?? 0)
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return { ok: false, error: 'payload-too-large' }
  }

  try {
    return { ok: true, value: await c.req.json() }
  } catch {
    return { ok: false, error: 'invalid-body' }
  }
}

function bodyError(c: Context, error: 'invalid-body' | 'payload-too-large') {
  return error === 'payload-too-large'
    ? c.json({ error }, 413)
    : c.json({ error }, 400)
}

/** 组装 REST API；不传存储时使用一份全新的内存存储 */
export function createApp(store: MemoryStore = createMemoryStore()): Hono {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/posts', (c) => c.json({ posts: store.listPosts() }))

  app.post('/api/posts', async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return bodyError(c, body.error)

    const payload = body.value
    if (!isRecord(payload)) return c.json({ error: 'invalid-body' }, 400)

    const { content, topic } = payload
    if (typeof content !== 'string') return c.json({ error: 'invalid-body' }, 400)
    if (topic !== undefined && typeof topic !== 'string') {
      return c.json({ error: 'invalid-body' }, 400)
    }

    const text = content.trim()
    if (!text) return c.json({ error: 'content-empty' }, 400)
    if (countChars(text) > CHAR_LIMIT) return c.json({ error: 'content-too-long' }, 400)

    const post = store.createPost({ content: text, topic: normalizeTopic(topic) })
    return c.json({ post }, 201)
  })

  app.delete('/api/posts/:id', (c) => {
    const result = store.deletePost(c.req.param('id'))
    if (!result.ok) {
      return result.reason === 'forbidden'
        ? c.json({ error: 'forbidden' }, 403)
        : c.json({ error: 'not-found' }, 404)
    }
    return c.body(null, 204)
  })

  app.put('/api/posts/:id/like', async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return bodyError(c, body.error)

    const payload = body.value
    if (!isRecord(payload) || typeof payload.liked !== 'boolean') {
      return c.json({ error: 'invalid-body' }, 400)
    }

    const result = store.setLike(c.req.param('id'), payload.liked)
    if (!result.ok) return c.json({ error: 'not-found' }, 404)
    return c.json({ post: result.post })
  })

  app.put('/api/posts/:id/favorite', async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return bodyError(c, body.error)

    const payload = body.value
    if (!isRecord(payload) || typeof payload.favorited !== 'boolean') {
      return c.json({ error: 'invalid-body' }, 400)
    }

    const result = store.setFavorite(c.req.param('id'), payload.favorited)
    if (!result.ok) return c.json({ error: 'not-found' }, 404)
    return c.json({ post: result.post })
  })

  app.get('/api/user', (c) => c.json({ user: store.getUser() }))

  app.patch('/api/user', async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return bodyError(c, body.error)

    const payload = body.value
    if (!isRecord(payload) || typeof payload.name !== 'string') {
      return c.json({ error: 'invalid-body' }, 400)
    }
    if (!payload.name.trim()) return c.json({ error: 'name-empty' }, 400)

    return c.json({ user: store.renameUser(payload.name) })
  })

  app.notFound((c) => c.json({ error: 'not-found' }, 404))

  app.onError((_error, c) => c.json({ error: 'internal' }, 500))

  return app
}
