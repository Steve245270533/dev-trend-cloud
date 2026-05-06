# Agent 入口（Repository Map）

本文件是智能体在 `dev-trend-cloud` 仓库内工作的入口与路由导航，目标是提供“地图”而不是“百科全书”：先确认当前实现与阶段边界，再进入具体子包文档。

## 0. 元规则（优先执行）

在开始任何任务前，先检查：

1. 你使用的技术栈/规范是否与项目当前实际情况一致？
2. 若发现本文件或相关文档已过时，立即停止编码，先执行：
   - 生成一份更新建议（格式：`[文件路径] 需要更新的部分 -> 建议内容`）
   - 等待用户确认后再更新文档，再继续编码

触发本规则的典型信号：新增/修改了子包中的模块但关联该模块索引的文档未记录、发现代码与规范文档描述不一致。

## 事实源与范围

- 当前规划事实源： [devtrend-cloud-practical-plan-2026-05-05-v5.md](./docs/plan/devtrend-cloud-practical-plan-2026-05-05-v5.md)
- 历史规划参考： [devtrend-cloud-practical-plan-2026-04-29-v4.md](./docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md)
- 当前代码实现：`Phase 0 + Phase 1` 已稳定，`Phase 2` 已完成 `S1`、`S2`、`S3`、`S4` MVP，并进入 `S5 / Topic Read API` 准备态
- 当前文档规划目标：继续在 `Phase 2 / Dynamic Topic Layer + Feature Layer MVP` 内推进 `S5 -> S6`
- 若旧文档与新计划冲突，以 `2026-05-05 v5` 为准

## 强约束（禁止项）

当前阶段与下一阶段规划中，仍禁止或暂缓：

- 鉴权（API keys、RBAC）、计费/配额、团队账号
- direct GitHub API / GH Archive ingestion
- 需要登录态或 cookie 的数据源
- 把 LLM 用作核心评分或最终置信度裁决

以下能力不是当前阶段的立即优先级：

- watchlist CRUD API 产品化
- digest / webhook 交付
- 完整 analyst console

## 必须遵循的实现顺序

1. 文档
2. monorepo 与工具链
3. 数据库与 seed / canonical models
4. source collectors 与 contract audit
5. domain pipeline / feature layer / topic layer
6. API 与 worker
7. 测试与验证

## 全局工程偏好

- `pnpm` workspace + `TypeScript + SWC`
- Fastify：`@fastify/type-provider-typebox` + `env-schema` + 结构化错误 + `healthz/readyz`
- BullMQ 负责异步编排
- pipeline 决策坚持 `rule-first + embedding-assisted`
- LLM 仅用于 `topic naming / summary / keyword suggestion`，不要把核心决策外包给 LLM
- GitHub 信号在当前路线中仅表示 `OSSInsight-backed GitHub adoption proxy`

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
- 下一阶段若文档提到 `GitHub`，默认仍指 OSSInsight 代理层，而不是直接 GitHub 数据源

## 文档导航

- 顶层架构地图： [architecture.md](./architecture.md)
- 开发与运行： [development.md](./docs/development.md)
- API 路由与响应： [api.md](./docs/api.md)
- 最新开发计划： [devtrend-cloud-practical-plan-2026-05-05-v5.md](./docs/plan/devtrend-cloud-practical-plan-2026-05-05-v5.md)
- 阶段性开发拆解： [devtrend-cloud-phase2-execution-stages-2026-05-05.md](./docs/plan/devtrend-cloud-phase2-execution-stages-2026-05-05.md)

## 子包路由（按职责进入）

- API（Fastify 只读接口，后续向 topic/insight read APIs 演进）： [apps/api/AGENTS.md](./apps/api/AGENTS.md)
- Worker（BullMQ 编排与任务，后续承接 embedding/topic jobs）： [apps/worker/AGENTS.md](./apps/worker/AGENTS.md)
- Web（轻量只读控制台，非完整 analyst console）： [apps/web/AGENTS.md](./apps/web/AGENTS.md)
- Config（环境 schema）： [packages/config/AGENTS.md](./packages/config/AGENTS.md)
- Contracts（TypeBox DTO）： [packages/contracts/AGENTS.md](./packages/contracts/AGENTS.md)
- DB（migrations/seeds/repos）： [packages/db/AGENTS.md](./packages/db/AGENTS.md)
- Domain（问题层 + 主题层的确定性逻辑）： [packages/domain/AGENTS.md](./packages/domain/AGENTS.md)
- Sources（OpenCLI registry/collectors/normalizers/audit）： [packages/sources/AGENTS.md](./packages/sources/AGENTS.md)
