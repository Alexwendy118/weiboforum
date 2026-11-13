import { serve } from '@hono/node-server'
import { createApp } from './app'

const port = Number(process.env.PORT ?? 8787)
const hostname = process.env.HOST ?? '127.0.0.1'

const app = createApp()

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`[api] 微波论坛后端已启动：http://${hostname}:${info.port}/api`)
})
