# 微波论坛（Microwave Forum）v2.0

一个 **Vue 3 + Pinia + Hono** 的轻量微社区单页应用。前端通过 REST API 访问本地 **Hono 服务**，数据保存在**服务端内存**中：刷新页面不会丢，重启服务后重新播种示例内容。

项目按**领域逻辑 / API 客户端 / 状态管理 / UI 组件 / 服务端**分层，前端与后端均以 **TDD（测试先行）** 方式开发。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 运行时 | Node.js ≥ 22.12 |
| 前端 | Vue 3（Composition API + `<script setup lang="ts">`）、Pinia（setup store） |
| 构建 | Vite 8 |
| 后端 | Hono 4 + `@hono/node-server`（内存存储，无数据库） |
| 运行 TS | tsx（`dev:api` / `start:api`） |
| 测试 | Vitest 5 + @vue/test-utils + jsdom（服务端测试用 `@vitest-environment node`） |
| 类型 | TypeScript（strict）+ vue-tsc |

## 快速开始

```bash
npm install
npm run dev        # 并行启动前端与后端：web http://localhost:5173，api http://127.0.0.1:8787
npm test           # 全部测试（13 个文件 / 162 个用例）
npm run typecheck  # 仅类型检查
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run preview    # 预览生产构建（/api 仍代理到 8787）
```

只启动其中一端：

```bash
npm run dev:web    # 仅 Vite
npm run dev:api    # 仅 Hono（tsx watch）
```

> `npm run dev` 依赖 `concurrently`；前端通过 Vite 代理把 `/api` 转发到 `127.0.0.1:8787`，因此浏览器里只需要访问 5173。

## 功能

- 发布文字动态（上限 140 字，实时字数提示，超限禁用发布并抖动提醒），发布时选择板块
- 时间线按发布时间倒序展示，相对时间显示（刚刚 / N 分钟前 / N 小时前 / N 天前 / 具体日期）
- 视图切换：实时 / 热门（按点赞排序）/ 我的 / 我赞过的 / 我收藏的；板块筛选可与视图叠加
- 点赞 / 取消点赞（乐观更新 + 失败回滚），数量与状态由服务端保存，并实时反映到热榜与统计
- 收藏 / 取消收藏（与点赞同构：乐观更新 + 失败回滚 + 请求串行化），服务端保存收藏状态，导航与统计实时联动
- 删除自己发布的动态（仅本人可见入口，二次确认 + 淡出动画，服务端校验权限）
- 关键词搜索（匹配正文、昵称或板块，大小写不敏感），输入即筛，回车/点击搜索给出结果提示
- 热榜：按点赞排名，支持换一换、查看更多/收起，点击条目自动清空筛选并滚动定位、高亮对应动态
- 昵称修改，服务端同步更新本人已发布内容的作者名
- 空状态引导、Toast 提示、加载中占位、暗色模式与减少动效适配
- 后端不可用时给出「无法连接服务」提示，不会把网络故障误报成空社区

## 目录结构

```
.
├── server/                    # Hono 后端（内存存储）
│   ├── store.ts               # createMemoryStore：动态、用户、播种、点赞/删除/改名规则
│   ├── app.ts                 # createApp：REST 路由、校验、错误码、请求体上限
│   ├── index.ts               # 启动入口（PORT 默认 8787）
│   └── app.test.ts            # 后端契约测试（node 环境，app.request）
├── src/
│   ├── main.ts
│   ├── App.vue                # 布局装配与跨组件协作（弹层、滚动定位、连接提示）
│   ├── api/
│   │   ├── client.ts          # fetch 封装、超时、错误码、响应形状校验
│   │   └── client.test.ts
│   ├── domain/                # 纯函数领域逻辑，零 Vue 依赖
│   │   ├── types.ts           # Post / User / Topic / ViewMode
│   │   ├── constants.ts       # 字数上限、板块、头像调色板
│   │   ├── text.ts / time.ts  # 字数、截断、相对时间
│   │   ├── posts.ts           # 规范化、示例数据、筛选、排序
│   │   ├── hot.ts             # 热榜排名与轮转
│   │   └── empty.ts           # 空状态文案
│   ├── stores/
│   │   └── forum.ts           # 唯一数据源：hydrate + 异步写操作 + 派生状态
│   ├── composables/useToast.ts
│   ├── components/            # 展示与交互组件
│   ├── test/
│   │   ├── fakeApi.ts         # 内存假后端（vi.stubGlobal('fetch')）
│   │   ├── helpers.ts         # 测试夹具
│   │   └── setup.ts           # jsdom 环境补齐
│   └── **/*.test.ts
├── legacy/                    # v1.x 纯 HTML 实现归档
├── styles.css
└── vite.config.ts             # 别名、/api 代理、Vitest 配置
```

## 数据流与分层

```
浏览器组件 ──> stores/forum.ts ──> api/client.ts ──fetch──> Hono /api
                   │                                          │
                   └── computed：visiblePosts / hotBoard / stats / navCounts
                                                                  │
                                                       server/store.ts（内存）
```

- **server/store.ts**：进程内单用户数据源，播种 3 条示例动态；重启即重置。
- **server/app.ts**：只做 HTTP 协议层——解析、校验、状态码映射，不含业务规则。
- **api/client.ts**：统一超时（8s）、把网络失败归一为 `ApiError(0)`、拒绝结构不符的响应。
- **stores/forum.ts**：唯一可变状态；`hydrate()` 首屏拉取，写操作异步化并处理失败回滚。
- **组件**：props + 事件，自身只保留输入、动画、滚动等 DOM 行为。

## REST API

Base：`/api`，请求/响应均为 JSON；错误统一 `{ "error": "<code>" }`。

| 方法 | 路径 | 说明 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/health` | 健康检查 | 200 `{ ok: true }` | — |
| GET | `/posts` | 全部动态，按 createdAt 倒序 | 200 `{ posts }` | — |
| POST | `/posts` | `{ content, topic? }` | 201 `{ post }` | 400 `content-empty` / `content-too-long` / `invalid-body`；413 `payload-too-large` |
| DELETE | `/posts/:id` | 删除本人动态 | 204 | 403 `forbidden`；404 `not-found` |
| PUT | `/posts/:id/like` | `{ liked: boolean }`，幂等 | 200 `{ post }` | 400 `invalid-body`；404 `not-found` |
| PUT | `/posts/:id/favorite` | `{ favorited: boolean }`，幂等 | 200 `{ post }` | 400 `invalid-body`；404 `not-found` |
| GET | `/user` | 当前身份 | 200 `{ user }` | — |
| PATCH | `/user` | `{ name }`，自动截断到 12 字符并同步本人动态作者名 | 200 `{ user }` | 400 `name-empty` / `invalid-body` |

其他 `/api/*` 返回 404 `{ error: 'not-found' }`；未捕获异常返回 500 `{ error: 'internal' }`，不暴露堆栈。

## 测试（TDD）

开发顺序严格按红 → 绿 → 重构推进：先写测试并确认失败，再实现到通过。

| 测试文件 | 数量 | 覆盖内容 |
| --- | --- | --- |
| `server/app.test.ts` | 33 | 全部端点契约、状态码、字段完整、倒序、幂等点赞/收藏、越权删除、改名同步、实例隔离、请求体上限 |
| `src/api/client.test.ts` | 8 | 响应解析、结构不符报错、错误码透传、网络异常归一、收藏请求 |
| `src/domain/*.test.ts` | 51 | 字数/时间/规范化/筛选/排序/热榜/空状态（含收藏视图筛选） |
| `src/stores/forum.test.ts` | 38 | hydrate、发布校验、点赞与收藏的幂等/竞态/回滚、删除权限、改名、筛选/统计、热榜、网络失败 |
| `src/components/*.test.ts` | 39 | 发布卡、动态卡（含收藏按钮）、时间线、热榜的渲染与异步交互 |
| `src/App.test.ts` | 19 | 集成流程：发布 / 搜索 / 筛选 / 改名 / 点赞 / 收藏 / 删除 / 定位 / 重新拉取 / 加载与断连态 |

最近一次验收：

```
Test Files  13 passed (13)
     Tests  188 passed (188)
vue-tsc --noEmit  通过
vite build        通过
浏览器验收        通过（收藏切换 / Tab 筛选 / 刷新持久化）
```

## 存储说明

- 数据只存在于 Hono 进程内存：**刷新浏览器不丢，重启后端回到 3 条示例动态**。
- 没有数据库、没有账号体系，服务端只维护一个本地身份；多标签页共享同一份数据。
- 清空数据：重启 `npm run dev:api`。

## 响应式

| 视口 | 布局 |
| --- | --- |
| > 1180px | 左栏 + 中栏 + 右栏三栏并排 |
| 900 ~ 1180px | 左栏折叠为横向胶囊按钮条，中栏 + 右栏两栏 |
| < 900px | 单栏纵向：导航胶囊条 → 发布与动态流 → 热榜与推广卡 |
| < 640px | 单列，按钮与输入框适配触控尺寸，无横向滚动 |

## 更新日志

- **v2.1**：新增**收藏功能**（对齐点赞交互）：`PUT /posts/:id/favorite` 端点、动态卡收藏按钮、「我收藏的」视图 Tab、导航收藏计数、乐观更新 + 失败回滚 + 请求串行化；测试从 162 增至 188。开发采用 Git Worktree 双分支（后端 / 前端）并行 TDD 实现后合并。
- **v2.0**：从 localStorage 迁移到 **Hono + REST + 内存存储**。新增 `server/`（store / app / 入口）与 `src/api/client.ts`；store 写操作异步化并支持失败回滚、点赞请求串行化、加载态与断连提示；测试从 120 增至 162，新增服务端契约测试与假后端。旧的 `src/storage/localStore.ts` 与 `STORAGE_KEYS` 已移除。
- **v1.1**：新增左右侧栏、顶部通栏搜索条、视图 Tab、板块字段与热榜定位交互；三栏响应式断点。
- **v1.0**：首个版本，单列信息流 + 发布 / 点赞 / 删除 / 搜索 / 本地昵称。

## 说明

- 所有用户文本都通过 Vue 模板插值渲染（等价于 `textContent`），不会执行 HTML，从根本避免 XSS。
- 后端无鉴权，仅供本地演示；如需多用户，请在 `server/` 增加会话与鉴权中间件。
