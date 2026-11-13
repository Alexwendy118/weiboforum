# 微波论坛（Microwave Forum）v2.0

一个使用 **Node.js + Vue 3 + Pinia** 重写的轻量微社区单页应用。数据仍然只保存在浏览器 `localStorage`，没有后端、没有账号体系，刷新或重开浏览器后内容依然在。

v2.0 是对 v1.x（纯 HTML + CSS + 原生 JS）的完整重写，行为与视觉保持一致，但代码按**领域逻辑 / 状态管理 / UI 组件**分层，并以 **TDD（测试先行）** 的方式开发。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 运行时 | Node.js ≥ 22.12 |
| 框架 | Vue 3（Composition API + `<script setup lang="ts">`） |
| 状态 | Pinia（setup store） |
| 构建 | Vite |
| 测试 | Vitest + @vue/test-utils + jsdom |
| 类型 | TypeScript + vue-tsc |

## 快速开始

```bash
npm install       # 安装依赖
npm run dev       # 本地开发，默认 http://localhost:5173
npm test          # 跑全部单元 / 组件 / 集成测试（120 个）
npm run typecheck # 仅做类型检查
npm run build     # 类型检查 + 生产构建，产物在 dist/
npm run preview   # 预览生产构建
```

## 功能

- 发布文字动态（上限 140 字，实时字数提示，超限禁用发布并抖动提醒），发布时选择板块
- 时间线按发布时间倒序展示，相对时间显示（刚刚 / N 分钟前 / N 小时前 / N 天前 / 具体日期）
- 视图切换：实时 / 热门（按点赞排序）/ 我的 / 我赞过的；板块筛选可与视图叠加
- 点赞 / 取消点赞，数量与状态持久化，并实时反映到热榜与统计
- 删除自己发布的动态（仅本人可见入口，二次确认 + 淡出动画）
- 关键词搜索（匹配正文、昵称或板块，大小写不敏感），输入即筛，回车/点击搜索给出结果提示
- 热榜：按点赞排名，支持换一换、查看更多/收起，点击条目自动清空筛选并滚动定位、高亮对应动态
- 本地昵称修改，修改后同步更新自己已发布的内容
- 空状态引导、Toast 提示、暗色模式与减少动效适配
- 本地存储不可用（隐私模式 / 配额满）时自动降级为内存态并给出提示

## 目录结构

```
.
├── index.html                 # Vite 入口，仅保留挂载点
├── styles.css                 # 主题、三栏布局、动画与响应式样式（沿用 v1.x）
├── vite.config.ts             # Vite + Vitest 配置
├── tsconfig.json
├── legacy/                    # v1.x 纯 HTML 实现归档，可直接用浏览器打开
│   ├── index.html
│   └── app.js
└── src/
    ├── main.ts                # 创建应用、注册 Pinia、引入全局样式
    ├── App.vue                # 页面布局装配与跨组件协作（弹层、滚动定位、空状态动作）
    ├── domain/                # 纯函数领域逻辑，零 Vue 依赖
    │   ├── types.ts           # Post / User / Topic / ViewMode
    │   ├── constants.ts       # 字数上限、板块、存储 key、头像调色板
    │   ├── text.ts            # 字数统计、截断、首字、颜色哈希
    │   ├── time.ts            # 相对时间 / 完整时间格式化
    │   ├── posts.ts           # 数据规范化、示例数据、筛选、排序
    │   ├── hot.ts             # 热榜排名与「换一换」轮转
    │   ├── empty.ts           # 空状态文案
    │   └── id.ts              # id 生成
    ├── storage/
    │   └── localStore.ts      # localStorage 读写封装（失败降级）
    ├── stores/
    │   └── forum.ts           # Pinia store：动态、身份、筛选、热榜、持久化
    ├── composables/
    │   └── useToast.ts        # 全局 Toast
    ├── components/            # 展示与交互组件
    │   ├── TopBar.vue         # 品牌栏、本地统计、身份入口
    │   ├── HeroSection.vue    # Hero 文案、通栏搜索、数据统计
    │   ├── SideNav.vue        # 视图导航与板块筛选
    │   ├── ComposerCard.vue   # 发布卡（板块选择、字数、快捷键）
    │   ├── TimelinePanel.vue  # 视图 Tab、条数、时间线、定位
    │   ├── PostCard.vue       # 单条动态（点赞、删除、高亮）
    │   ├── EmptyState.vue     # 空状态
    │   ├── HotBoard.vue       # 微波热榜
    │   ├── PromoCard.vue      # 本地版推广卡
    │   ├── MiniTip.vue        # 小提示
    │   ├── UserDialog.vue     # 昵称弹层（原生 dialog）
    │   ├── ToastMessage.vue   # Toast 渲染
    │   ├── AppAvatar.vue      # 渐变头像
    │   ├── AppIcon.vue        # 统一图标
    │   └── icon-paths.ts
    ├── test/
    │   ├── setup.ts           # jsdom 环境补齐（scrollIntoView / dialog）
    │   └── helpers.ts         # 测试夹具
    └── **/*.test.ts           # 与实现同目录的测试
```

## 数据流与分层

```
localStorage ──read/write──> storage/localStore ──> stores/forum.ts（唯一数据源）
                                                          │
                                          computed：visiblePosts / hotBoard / stats / navCounts
                                                          │
             App.vue ── props & events ──> 展示组件（Composer / Timeline / HotBoard / ...）
```

- **domain/**：纯函数，方便先写测试再实现，也不依赖浏览器
- **stores/forum.ts**：唯一可变状态；所有写操作（发布、点赞、删除、改名、筛选、热榜）都在这里统一持久化
- **组件**：通过 props 接收数据、通过事件向外冒泡；只保留与自身交互强相关的 DOM 行为（输入、动画、滚动）
- **App.vue**：负责布局装配与跨组件协作（如空状态「去发布」→ 聚焦发布框；热榜点击 → 时间线定位）

## 测试（TDD）

开发顺序严格按红 → 绿 → 重构推进：先写测试并确认失败，再实现到通过。

| 测试文件 | 数量 | 覆盖内容 |
| --- | --- | --- |
| `src/domain/text.test.ts` | 11 | emoji 字数、截断、首字、头像哈希 |
| `src/domain/time.test.ts` | 6 | 相对时间、跨年、完整时间补零 |
| `src/domain/posts.test.ts` | 18 | 数据规范化、示例数据、筛选叠加、排序 |
| `src/domain/hot.test.ts` | 7 | 排名、折叠/展开、换一换轮转 |
| `src/domain/empty.test.ts` | 6 | 各场景空状态文案与动作 |
| `src/stores/forum.test.ts` | 27 | 读写存储、发布校验、点赞、删除权限、改名、统计、热榜 |
| `src/components/*.test.ts` | 31 | 发布卡、动态卡、时间线、热榜的渲染与交互 |
| `src/App.test.ts` | 14 | 全流程集成：发布 / 搜索 / 筛选 / 改名 / 定位 / 刷新持久化 / 结构类名 |

最近一次完整验收：

```
Test Files  11 passed (11)
     Tests  120 passed (120)
vue-tsc --noEmit  通过
vite build        通过
```

## 数据存储

沿用 v1.x 的 key，旧数据可直接读取，无需迁移：

| Key | 说明 |
| --- | --- |
| `mwb.posts.v1` | 全部动态数组，元素含 `id / authorId / author / topic / content / createdAt / likes / likedByMe` |
| `mwb.user.v1` | 当前本地身份（`id` 与昵称） |

- 首次访问写入 3 条示例动态（`seed-*`）。
- 读取时会做规范化：缺失字段补默认值、非法板块回落为「随笔」、点赞数不为负、没有正文的条目丢弃；损坏的 JSON 会回落到示例内容。
- 写入失败（隐私模式 / 配额满）时降级为内存态，并通过 Toast 提示。
- 清空数据：浏览器开发者工具 → Application → Local Storage → 删除上述两个 key，刷新后恢复初始示例内容。

## 响应式

| 视口 | 布局 |
| --- | --- |
| > 1180px | 左栏 + 中栏 + 右栏三栏并排 |
| 900 ~ 1180px | 左栏折叠为横向胶囊按钮条，中栏 + 右栏两栏 |
| < 900px | 单栏纵向：导航胶囊条 → 发布与动态流 → 热榜与推广卡 |
| < 640px | 均为单列，按钮与输入框适配触控尺寸，无横向滚动 |

## 更新日志

- **v2.0**：使用 Vue 3 + TypeScript + Pinia 重写，按领域逻辑 / 状态管理 / 组件分层；新增 Vitest 测试体系（120 个测试）与类型检查；数据 key 与交互行为保持兼容。旧版纯 HTML 实现归档到 `legacy/`。
- **v1.1**：新增左右侧栏、顶部通栏搜索条、视图 Tab、板块字段与热榜定位交互；三栏响应式断点。
- **v1.0**：首个版本，单列信息流 + 发布 / 点赞 / 删除 / 搜索 / 本地昵称。

## 说明

- 所有用户文本都通过 Vue 模板插值渲染（等价于 `textContent`），不会执行 HTML，从根本避免 XSS。
- 本项目仅用于本地演示，没有后端与账号体系，数据不会离开本机浏览器。
