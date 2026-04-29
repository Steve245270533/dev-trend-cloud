# 计划：apps/web（Vite + Vue3 + Element Plus + TailwindCSS）只读 Console

## Summary

基于当前 Phase 0 + Phase 1 已暴露的只读 API（`/healthz`、`/readyz`、`/feed`、`/signals/question-pressure`、`/question-clusters/:id`、`/question-clusters/:id/evidence`），在 `apps/web` 落地一个“只读轻量 Console”，用于更直观地浏览 Question Pressure 信号、查看 cluster 详情与 evidence drilldown，并提供 feed 调试与健康状态概览。

界面方向：

- **骨架（frontend-design）**：左侧导航 + 顶部状态条 + 以 bento 卡片/分区网格组织数据（信号概览 → 列表 → 详情 drilldown），保证“入口清晰、钻取顺滑、信息密度可控”。
- **主体风格（ui-ux-pro-max）**：暗色 bento，强调对比与可读性；状态色用于 source health / growth / confidence；交互遵循 loading/empty/error 三态与可复位筛选。

约束确认：

- 不新增鉴权、账号、写入型业务 API。
- 不实现 watchlist CRUD（后端当前也未暴露）。
- 依赖与配置变更限定在 `apps/web` 内（用户已授权），避免影响现有后端 `pnpm lint/typecheck/test`。

## Current State Analysis（基于仓库实况）

### 1) 当前 `apps/web` 为占位

- `apps/web/package.json` 仅包含占位 `dev` 脚本：[package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/apps/web/package.json)
- 文档明确 Phase 0 + 1 不交付 console UI：[AGENTS.md](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/apps/web/AGENTS.md)、[README.md](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/apps/web/README.md)

由于本需求已确认升级为“只读 Console”，上述文档需要同步更新边界描述（避免与事实不一致）。

### 2) API 形状与可用路由

- 路由与 schema：[/apps/api/src/routes/index.ts](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/apps/api/src/routes/index.ts)
- 文档摘要：[/docs/api.md](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/docs/api.md)

端点清单（只读）：

- `GET /healthz`
- `GET /readyz`
- `GET /feed?topic?entity?source?limit`
- `GET /signals/question-pressure?topic?entity?limit`
- `GET /question-clusters/:clusterId`
- `GET /question-clusters/:clusterId/evidence?limit`

### 3) Monorepo 工具链对前端的影响（关键发现）

- 根 `tsconfig.json` include：`apps/**/*.ts`，且 `lib` 不包含 DOM（只含 `ES2023`），这是为后端 Node 环境收敛的配置：[tsconfig.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/tsconfig.json)、[tsconfig.base.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/tsconfig.base.json)

结论：如果 `apps/web` 直接使用 TypeScript + `.ts` 入口，会被根 `tsc` 纳入并因 DOM 类型缺失/`.vue` 类型缺失导致 `pnpm typecheck` 失败。因此本次前端实现将默认以 **JS + Vue SFC** 为主（仍用 Composition API + `<script setup>`），后续如要 TS 化再单独做一次 repo 级 typecheck 策略调整（可选的 Phase 3+ 工程化工作）。

## Proposed Changes

### A. 文档同步（避免与事实冲突）

1) 更新 `apps/web/AGENTS.md`

- 将“占位”改为“只读 Console（Phase 0+1 数据可视化/调试）”
- 明确禁止项：鉴权/账号/写入 API/watchlist 管理界面仍不做
- 标注 API 边界：仅消费现有只读端点

2) 更新 `apps/web/README.md`

- 增加本地开发指引：如何启动 api + web、如何配置 API base url

（可选）更新 `docs/development.md`

- 增加 `apps/web` 的启动命令与端口说明

### B. 创建前端应用（Vite + Vue3 + Element Plus + TailwindCSS）

#### 1) 依赖与工程文件（全部限制在 apps/web）

新增/修改文件（示例，不限于）：

- `apps/web/package.json`：添加 `vite`、`@vitejs/plugin-vue`、`vue`、`vue-router`、`element-plus`、`tailwindcss`、`postcss`、`autoprefixer`；按需加 `echarts`（用户允许）
- `apps/web/index.html`
- `apps/web/vite.config.(js|mjs)`：dev proxy `'/api' -> http://localhost:3000`，rewrite 去掉 `/api`
- `apps/web/tailwind.config.js`、`apps/web/postcss.config.js`
- `apps/web/src/main.js`、`apps/web/src/App.vue`
- `apps/web/src/styles/index.css`：Tailwind 入口 + 主题变量（暗色 bento tokens）

关键策略：

- 前端请求统一走 `/api/*`，避免后端改 CORS（当前 API 未配置 CORS）
- 不触碰根目录 `tsconfig`/`turbo`/`pnpm-workspace.yaml`，降低对后端 pipeline 的影响面

#### 2) 信息架构与页面（骨架确认）

导航结构（左侧 Sidebar + 顶部 Topbar）：

- Question Pressure（默认首页）
- Feed Explorer（调试入口）
- Health（运行状态）

页面列表：

1) **Question Pressure**
- 数据源：`GET /signals/question-pressure`
- 交互：topic/entity 筛选、limit 控制、刷新；按 pressureScore 排序（后端已排序）
- 展示：bento 概览卡（Top metrics）+ 列表（卡片或 table）+ 状态标识（growth/confidence/freshness）
- 点击行进入 Cluster 详情

2) **Cluster Detail**
- 数据源：`GET /question-clusters/:id` + `GET /question-clusters/:id/evidence`
- 展示：canonical question、pressure/unresolved、growth/novelty、affected topics/entities、related repos、source distribution
- Evidence：按时间倒序列表，外链打开；提供复制链接
- 可视化（可选）：用 ECharts 渲染 sourceDistribution 的条形图/环形图（无图也可用 tag + 计数）

3) **Feed Explorer**
- 数据源：`GET /feed`
- 交互：source/topic/entity/limit 过滤，便于验证采集与匹配质量
- 展示：cards 列表（title/summary/tags/topics/entities/score/time/source）

4) **Health**
- 数据源：`GET /healthz`、`GET /readyz`，以及从任意业务接口 meta 读取 `sourceStatus`
- 展示：整体 health/ready 状态、sourceStatus 列表（healthy/degraded/failed）、lastSuccessAt、freshnessMinutes

#### 3) 组件与代码组织（实现层面决策）

建议目录（feature-first，避免大组件）：

- `apps/web/src/features/question-pressure/`
  - `QuestionPressurePage.vue`
  - `components/SignalList.vue`
  - `components/SignalFilters.vue`
- `apps/web/src/features/cluster/`
  - `ClusterDetailPage.vue`
  - `components/EvidenceList.vue`
  - `components/SourceDistributionChart.vue`（可选）
- `apps/web/src/features/feed/FeedPage.vue`
- `apps/web/src/features/health/HealthPage.vue`
- `apps/web/src/shared/`
  - `api/client.js`（fetch 封装、错误统一结构）
  - `composables/useAsyncState.js`（loading/error/refresh）
  - `ui/`（少量通用展示组件：EmptyState、StatCard、SectionHeader）

状态管理：

- 默认不引入 Pinia（当前页面之间共享状态较少），使用 composables + `ref/computed` 即可

错误与空状态：

- 所有页面统一处理：loading skeleton、empty state（可操作提示）、error state（可重试）
- 严格避免在 UI 中展示/记录敏感信息（虽无鉴权，但也不打印 headers 等）

#### 4) 视觉设计系统（主体风格确认）

暗色 bento 设计要点：

- 背景：深色层次（base / surface / elevated），卡片轻微透明 + 细边框
- 强调色：电蓝/青作为主色；状态色：green=healthy、amber=degraded、red=failed
- 字体建议：Heading 使用更具性格的 serif/contrast 字体（如 Fraunces），正文使用易读 sans（如 Manrope），数字/指标用等宽（如 IBM Plex Mono）
- 信息密度：桌面端偏密集、移动端自动降密（列表卡片化）
- 动效：150–250ms，主要用于 hover/route 切换/加载 skeleton（尊重 prefers-reduced-motion）

### C. 运行与脚本（apps/web 内）

- `pnpm --filter @devtrend/web dev`：启动 Vite dev server
- `pnpm --filter @devtrend/web build`：打包静态产物（后续如需与后端同部署再讨论）
- 环境变量：`VITE_API_BASE_URL`（默认 `/api`），可在 `.env.local` 配置

## Assumptions & Decisions（已锁定）

- 仅消费当前只读 API；不扩展后端路由与鉴权。
- apps/web 使用 **JS**（非 TS）以避免破坏根 `pnpm typecheck` 的 Node-only TS 配置；仍采用 Vue3 Composition API + `<script setup>`。
- Vite dev proxy 作为跨域解决方案；不修改后端添加 CORS。
- ECharts 仅用于小型可视化（sourceDistribution），若实现成本/维护不匹配可降级为纯文本/Tag 展示。

## Verification

### 本地手工验证

1) 启动后端依赖（DB/Redis）与 API
- `pnpm dev:api`

2) 启动前端
- `pnpm --filter @devtrend/web dev`

3) 页面检查
- Question Pressure：能拉取并渲染列表；筛选生效；可进入详情
- Cluster Detail：详情与 evidence 可加载；外链跳转正确
- Feed Explorer：过滤条件生效
- Health：healthz/readyz 与 sourceStatus 可见

### 现有工程验收（防回归）

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Risks / Follow-ups

- 若未来必须 TS 化（`vue-tsc`、DOM lib、`.vue` shims），需要单独的 repo 级 typecheck 策略（例如从根 include 中排除 `apps/web`，或拆分前后端 tsconfig）。
- 如果要做更完善的数据可视化（趋势线、分布 drilldown），可能需要引入更系统的图表与数据格式化策略，但不应在本次只读 Console 里过度扩张范围。

