# 架构

本文件提供 DevTrend Cloud（Phase 0 + Phase 1）的顶层架构地图，目标是让智能体与工程师都能快速定位“应该去哪看什么”，而不是把所有细节塞进一个入口文件。

## 范围边界（Phase 0 + Phase 1）

本仓库只实现 [devtrend-cloud-practical-plan-2026-04-29-v4.md](./docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md) 中的 Phase 0 + Phase 1。

包含：

- 公开数据源（Stack Overflow / Hacker News / DEV / OSSInsight）的 OpenCLI 合约审计与采集
- raw snapshot 捕获、归一化、topic/entity 匹配
- 规则优先的问题抽取、聚类与 question pressure 评分
- Postgres 持久化、Redis 缓存
- Fastify 只读 API
- BullMQ worker 的异步编排

不包含：

- 鉴权（API keys、RBAC）、计费、配额
- watchlist CRUD API、digest/webhook 交付、前端控制台产品化
- GitHub API / GH Archive ingestion
- 需要登录态或 cookie 的社交数据源

## 系统形态

```text
OpenCLI public sources
  -> runtime topic discovery (OSSInsight collections/hot-collections + DEV tags)
  -> runtime topic seed snapshot
  -> contract audit (registry/help/sample fixtures)
  -> collectors (per-command attempts, partial success allowed)
  -> dynamic query expansion from active runtime topics
  -> worker fallback (reuse last successful raw snapshot for the same source+command)
  -> raw snapshots JSONB
  -> normalizers (canonical items)
  -> topic/entity matcher (seed catalog)
  -> question extractor (rule-first)
  -> question clusterer (rule-first + pg_trgm)
  -> question pressure scorer
  -> Postgres persistence
  -> Redis cache
  -> Fastify read-only API

BullMQ worker
  -> topic-seed-refresh
  -> contract-audit
  -> collect
  -> normalize
  -> match
  -> cluster
  -> score
  -> conditional bootstrap enqueue on cold start
```

## 运行时分层

### Source 层（packages/sources）

- 目标：把“外部站点能力”收敛为可审计的 OpenCLI 命令合约 + 稳定的采集/归一化输出。
- 额外职责：基于 OSSInsight collection 与 DEV tags 发现 runtime topics，并把 topic discovery 与内容采集解耦。
- 合约审计产物：
  - OpenCLI registry 快照
  - `--help` 快照
  - 代表性 JSON 样本（fixtures）
- collector 允许按 command 记录失败，不以“单命令失败 = 整轮失败”作为默认行为。
- content collect 不直接重新发现 topic，而是消费 worker 刷新的 active runtime topic snapshot。
- 注意：本阶段只允许 public sources（无需登录态）。

### Domain 层（packages/domain）

该层只放确定性规则与可测试的信号逻辑，避免把“决策”散落在 worker 或 API。

- matching：topic/entity 的 catalog 与匹配规则
- questions：从归一化 items 中抽取问题与聚类
- scoring：question pressure 评分与标签

聚类规则必须保持 rule-first：

- normalized title
- token overlap
- `pg_trgm` 相似度
- topic/entity overlap
- time window grouping

`pgvector` 允许在基础设施中启用，但不是本阶段的主依赖。

### Data 层（packages/db）

- Postgres 是事实源（system of record）
- `raw_snapshots` 存储原始 payload（JSONB）
- `source_runs` 记录每次 command 尝试；fallback 只复用历史 snapshot，不复制 payload。
- `item_sources` 负责把 item 追到 `source_runs` 和 `raw_snapshots`，供 evidence drilldown 使用。
- `topics` 保持稳定 seed catalog；动态 topic 进入独立的 `runtime_topic_seed_runs` / `runtime_topic_seeds`，不覆盖 domain catalog。
- repository helpers 用显式 SQL 查询表达数据访问，不引入重 ORM 抽象

### Transport 层（apps/api）

- Fastify 提供只读 HTTP API
- 统一响应 envelope：`{ data, meta }`
- 健康检查：`/healthz`、`/readyz`

### Orchestration 层（apps/worker）

- BullMQ 负责调度与异步任务编排
- worker 调用 sources + domain + db，负责 runtime topic refresh、source-level fallback、source health rollup、持久化和缓存结果产出
- repeat cron 负责常规轮询；worker 启动时还会做一次条件式 bootstrap：
  - runtime topic active snapshot 缺失或过期时，立即补发一次 topic refresh
  - 持久化内容为空时，立即补发一次按 source 的 collect
  - bootstrap 是恢复冷启动和 `db:reset` 后空库状态的补偿机制，不替代常规 cron

## 代码库地图

```text
apps/
  api/       Fastify read API
  worker/    BullMQ schedulers and jobs
  web/       预留占位（Phase 0+1 不做 console）
packages/
  config/    环境变量 schema 与运行时配置
  contracts/ TypeBox schemas / DTOs（跨包共享）
  db/        migrations, seeds, repositories
  domain/    匹配、抽取、聚类、评分的确定性逻辑
  sources/   OpenCLI registry、collectors、normalizers、fixtures、audit
docs/
  plan/      产品与交付计划（source of truth）
```

## 下一步（文档路由）

- 开发与运行： [development.md](./docs/development.md)
- API 形状与路由： [api.md](./docs/api.md)
- Agent 执行规范入口： [AGENTS.md](./AGENTS.md)
