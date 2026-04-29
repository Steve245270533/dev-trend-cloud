# Agent 入口（Repository Map）

本文件是智能体在 `dev-trend-cloud` 仓库内工作的入口与路由导航，目标是提供“地图”而不是“百科全书”：在这里确定边界与入口，然后跳转到更具体的文档与子包 AGENTS。

## 0. 元规则（优先执行）

在开始任何任务前，先检查：

1. 你使用的技术栈/规范是否与项目当前实际情况一致？
2. 若发现本文件或相关文档已过时，立即停止编码，先执行：
   - 生成一份更新建议（格式：`[文件路径] 需要更新的部分 → 建议内容`）
   - 等待用户确认后再更新文档，再继续编码

触发本规则的典型信号：新增/修改了子包中的模块但关联该模块索引的文档未记录、发现代码与规范文档描述不一致。

## 事实源与范围

- 交付与范围事实源： [devtrend-cloud-practical-plan-2026-04-29-v4.md](./docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md)
- 当前交付边界：仅 `Phase 0 + Phase 1`
- 若实现细节与旧文档冲突，以 `2026-04-29 v4` 方案为准

## 强约束（禁止项）

本阶段禁止实现：

- 鉴权（API keys、RBAC）、计费/配额、团队账号
- watchlist CRUD API、digest/webhook 交付、console UI（`apps/web` 仅占位）
- GitHub API / GH Archive ingestion
- 需要登录态或 cookie 的数据源

## 必须遵循的实现顺序

1. 文档
2. monorepo 与工具链
3. 数据库与 seed catalog
4. source collectors 与 contract audit
5. domain pipeline
6. API 与 worker
7. 测试与验证

不要跳到 Phase 2 行为。

## 全局工程偏好（Phase 0 + 1）

- `pnpm` workspace + `TypeScript + SWC`
- Fastify：`@fastify/type-provider-typebox` + `env-schema` + 结构化错误 + `healthz/readyz`
- BullMQ 负责异步编排
- pipeline 决策 rule-first（不要把核心决策外包给 LLM）

## 硬性约束

- lint 规范：所有代码必须通过 `pnpm lint`（当前为 Biome check，以 `package.json` 的 `lint` 脚本为准）
- 类型安全：禁止使用 `any`（TypeScript），使用 `unknown` 或具体类型替代
- 跨包引用：workspace 子包之间只能通过包名顶级入口导入（例如 `@devtrend/contracts`），禁止跨包相对路径或深导入 `packages/<pkg>/src/**`
- 文档同步：新增业务模块必须同步更新对应文档
- 配置/依赖变更需授权：涉及 `package.json`、构建配置、核心配置等变更时，必须先提交变更申请并获得用户明确许可
- 技术栈演进允许：允许提出更优替代库或配置，并在获得授权后落地

## OpenCLI 规则

- 不以 `opencli verify --smoke` 作为主要 smoke 机制
- contract audit 与样本采集必须执行真实子命令
- 允许的数据源：Stack Overflow / Hacker News / DEV / OSSInsight

## 文档导航

- 顶层架构地图： [architecture.md](./architecture.md)
- 开发与运行： [development.md](./docs/development.md)
- API 路由与响应： [api.md](./docs/api.md)

## 子包路由（按职责进入）

- API（Fastify 只读接口）： [apps/api/AGENTS.md](./apps/api/AGENTS.md)
- Worker（BullMQ 编排与任务）： [apps/worker/AGENTS.md](./apps/worker/AGENTS.md)
- Web（占位）： [apps/web/AGENTS.md](./apps/web/AGENTS.md)
- Config（环境 schema）： [packages/config/AGENTS.md](./packages/config/AGENTS.md)
- Contracts（TypeBox DTO）： [packages/contracts/AGENTS.md](./packages/contracts/AGENTS.md)
- DB（migrations/seeds/repos）： [packages/db/AGENTS.md](./packages/db/AGENTS.md)
- Domain（匹配/抽取/聚类/评分）： [packages/domain/AGENTS.md](./packages/domain/AGENTS.md)
- Sources（OpenCLI registry/collectors/normalizers/audit）： [packages/sources/AGENTS.md](./packages/sources/AGENTS.md)
