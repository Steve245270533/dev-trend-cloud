# 架构

本文件提供 DevTrend Cloud 的顶层架构地图。它同时描述两件事：

- 当前仓库已经实现了什么
- 下一阶段将如何从 `Question Pressure MVP` 演进到 `Topic Layer / Feature Layer MVP`

## 当前实现边界（截至 2026-05-05）

当前仓库的代码实现仍以 [devtrend-cloud-practical-plan-2026-04-29-v4.md](./docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md) 的 `Phase 0 + Phase 1` 为主，但已经包含一些不应再被写成“占位”的能力。

### 已实现

- 公开数据源（Stack Overflow / Hacker News / DEV / OSSInsight）的 OpenCLI 合约审计与采集
- raw snapshot 捕获、归一化、topic/entity 匹配
- 规则优先的问题抽取、聚类与 question pressure 评分
- Postgres 持久化、Redis 缓存
- Fastify 只读 API
- BullMQ worker 的异步编排
- 轻量只读 web console
- runtime topic discovery

### 尚未实现

- embedding pipeline
- topic clustering / topic persistence
- LLM topic naming
- topic taxonomy（L1 / L2 / L3）
- insight-oriented APIs
- watchlist CRUD、digest、webhook
- 完整 analyst console

## 演进方向

当前系统的主链路更像：

```text
Raw data + normalized items + question pressure
```

下一阶段目标是演进到：

```text
Raw Data Layer
  -> Normalized Layer
  -> Feature Layer
  -> Topic Layer
  -> Insight Layer
  -> API / Delivery Layer
```

## 当前系统形态

```text
OpenCLI public sources
  -> runtime topic discovery (OSSInsight collections/hot-collections + DEV tags)
  -> runtime topic seed snapshot
  -> contract audit (registry/help/sample fixtures)
  -> adapter registry + source tasks
  -> collectors (per-task attempts, partial success allowed)
  -> route policy + circuit breaker
  -> dynamic query expansion from active runtime topics
  -> worker fallback (reuse last successful raw snapshot for the same source+command)
  -> raw snapshots JSONB
  -> adapter-backed normalizers (canonical items)
  -> topic/entity matcher (seed catalog)
  -> question extractor (rule-first)
  -> question clusterer (rule-first + pg_trgm)
  -> question pressure scorer
  -> Postgres persistence
  -> Redis cache
  -> Fastify read-only API
  -> lightweight read-only web console

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

## 下一阶段目标形态（规划，不代表当前已实现）

```text
OpenCLI public sources
  -> canonical content model
  -> source-specific features
  -> embedding generation
  -> topic clustering
  -> topic labeler (LLM-assisted)
  -> hierarchical taxonomy (L1/L2/L3)
  -> topic persistence
  -> insight read models
  -> topic / insight APIs
```

## 运行时分层

### Source 层（packages/sources）

- 目标：把外部站点能力收敛为可审计的 OpenCLI 命令合约 + 稳定采集输出。
- 当前职责：contract audit、collectors、normalizers、runtime topic discovery、route policy、breaker。
- 下一阶段职责：继续为统一内容模型提供稳定输入，并把 OSSInsight 代理层作为 `GitHub adoption proxy` 输入 Feature Layer。
- 注意：当前与下一阶段都只允许 public sources，不接入登录态数据源。

### Domain 层（packages/domain）

该层只放确定性规则与可测试信号逻辑，避免把决策散落在 worker 或 API。

- 当前能力：topic/entity matching、question extraction、question clustering、question pressure scoring。
- 下一阶段能力：在保持 rule-first 的前提下，引入 embedding-assisted topic clustering、topic merge guardrails、taxonomy 归并规则。
- 规则要求：LLM 不直接决定最终评分或置信度。

### Data 层（packages/db）

- Postgres 是事实源（system of record）。
- 当前对象：`raw_snapshots`、`source_runs`、`items`、`item_sources`、`topics`、`entities`、`question_clusters`、`signals`、`signal_evidence`、`runtime_topic_seed_runs`、`runtime_topic_seeds`。
- 当前基础设施：`pgvector` 已启用，但尚未成为线上主链路依赖。
- 下一阶段规划：为 embedding、topic cluster、topic label candidate、topic lineage、taxonomy node 预留持久化对象。

### Transport 层（apps/api）

- 当前：Fastify 提供只读 HTTP API 与统一响应 envelope。
- 下一阶段：新增 topic / insight read model，但不要把规划接口误写成当前已上线。

### Orchestration 层（apps/worker）

- 当前：BullMQ 负责 source refresh、collect、normalize、match、cluster、score、fallback、source health rollup。
- 下一阶段：在不破坏现有 question pipeline 的前提下，新增 embedding、topic clustering、topic naming、topic persistence jobs。

### Web 层（apps/web）

- 当前：轻量只读控制台已存在，可浏览 pressure、cluster、evidence、feed、health。
- 下一阶段：可以扩展为 topic / insight 浏览入口，但仍不等于完整 analyst console。

## 代码库地图

```text
apps/
  api/       Fastify read API
  worker/    BullMQ schedulers and jobs
  web/       轻量只读控制台
packages/
  config/    环境变量 schema 与运行时配置
  contracts/ TypeBox schemas / DTOs（跨包共享）
  db/        migrations, seeds, repositories
  domain/    问题层与主题层的确定性逻辑
  sources/   OpenCLI registry、collectors、normalizers、fixtures、audit
docs/
  plan/      产品与交付计划（source of truth）
```

## 事实源导航

- 最新计划： [devtrend-cloud-practical-plan-2026-05-05-v5.md](./docs/plan/devtrend-cloud-practical-plan-2026-05-05-v5.md)
- 历史计划： [devtrend-cloud-practical-plan-2026-04-29-v4.md](./docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md)
- 开发与运行： [development.md](./docs/development.md)
- API 形状与路由： [api.md](./docs/api.md)
- Agent 执行规范入口： [AGENTS.md](./AGENTS.md)
