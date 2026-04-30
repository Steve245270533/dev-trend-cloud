# 开发

本文件承载本仓库的开发、运行与基础设施信息。顶层架构请先阅读 [architecture.md](../architecture.md)。

## 前置条件

- Node.js `24.x`
- `pnpm` `10.x`
- `opencli` 已安装并可在 `PATH` 中访问
- Docker services at `/Users/lehuaixiaochen/Downloads/Project/Docker`

当前实现期望这些 public OpenCLI sources：

- Stack Overflow
- Hacker News
- DEV
- OSSInsight

## 工程约束

- workspace 子包之间引用只能使用包名顶级入口：`import { ... } from "@devtrend/<pkg>"`
- 禁止跨包相对路径或深导入 `packages/<pkg>/src/**`（例如 `../../contracts/src/index.js`）
- 新增对外 API 必须通过对应包的 `src/index.ts` 导出

## 基础设施

本项目扩展 `/Users/lehuaixiaochen/Downloads/Project/Docker/docker-compose.yml`。

Phase 0 + Phase 1 假设：

- Postgres 镜像升级为 `pgvector/pgvector:pg16`
- Redis 保持不变
- Postgres 初始化 SQL 启用：
  - `vector`
  - `pg_trgm`
  - `unaccent`
  - `pgcrypto`

## 环境变量

复制 `.env.example` 为 `.env` 并按需调整。

核心变量：

- `PORT`
- `HOST`
- `LOG_LEVEL`
- `DATABASE_URL`
- `REDIS_URL`
- `OPENCLI_BIN`
- `OPENCLI_TIMEOUT_MS`
- `CACHE_TTL_MINUTES`
- `QUEUE_PREFIX`
- `SOURCE_POLL_SO_CRON`
- `SOURCE_POLL_HN_CRON`
- `SOURCE_POLL_DEVTO_CRON`
- `SOURCE_POLL_OSSINSIGHT_CRON`
- `TOPIC_SEED_REFRESH_CRON`

当前共享 Docker baseline 中，Redis 通过 `/Users/lehuaixiaochen/Downloads/Project/Docker/redis/redis.conf` 启用认证，因此本地默认 URL 为：

```text
redis://:123456@127.0.0.1:6379
```

## 常用命令

安装依赖：

```bash
pnpm install
```

运行数据库迁移：

```bash
pnpm db:migrate
```

重置本地开发数据库与 Redis，并自动补跑全部 migrations：

```bash
pnpm db:reset
```

写入 Phase 数据（seed）：

```bash
pnpm db:seed
```

启动 API（watch）：

```bash
pnpm dev:api
```

启动 worker（watch）：

```bash
pnpm dev:worker
```

启动 Web Console（Vite）：

```bash
pnpm --filter @devtrend/web dev
```

通过 Turbo 同时启动：

```bash
pnpm dev
```

worker 启动说明：

- repeat cron 仍然负责常规周期调度。
- worker 冷启动时会先做一次 bootstrap 检查。
- 当 active runtime topic snapshot 缺失或过期时，会立即补发一次 `topic-seed-refresh`。
- 当数据库里还没有持久化内容时，会立即按 source 补发一次 `collect`，避免本地开发必须等到下一次 cron 才看到 PG 落库。
- bootstrap enqueue 是非阻塞的；常规重启且库中已有 snapshot 和内容时，worker 仍主要依赖 cron，不会每次都强制重采。

worker 日志说明：

- worker 关键阶段日志会写入仓库根目录 `logs/`，采用 `pino-roll` 自动滚动：
  - 文件命名：`logs/worker.YYYY-MM-DD.N.log`（`N` 为同周期内滚动序号）
  - 滚动策略：按天 + 单文件达到 `20m` 大小时滚动
  - 保留策略：最多保留 14 个已滚动文件（另保留当前活跃文件）
  - `logs/current.log` 始终指向当前活跃日志文件（symlink）
- 日志为 JSON Lines，每行包含：
  - `timestamp`：ISO 时间
  - `level`：`info` / `warn` / `error`
  - `event`：事件名（例如 `job.start`、`pipeline.persist.done`、`redis.cache.invalidate.done`）
  - `context`：结构化上下文（例如 `queue`、`jobId`、`source`、`durationMs`、计数统计）
- 可直接用 `tail -f logs/current.log` 观察 worker 执行过程。

构建：

```bash
pnpm build
```

类型检查：

```bash
pnpm typecheck
```

测试：

```bash
pnpm test
```

运行 OpenCLI contract audit：

```bash
pnpm audit:contracts
```

## 验证口径

本阶段真实验证优先级：

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm db:migrate`
5. `pnpm db:seed`
6. `pnpm audit:contracts`

采集失败与 fallback 的预期行为：

- 单个 command 失败不能拖垮整轮采集。
- worker 会优先尝试 live payload；失败时只允许回退到同一个 `source + command` 最近一次成功 `raw_snapshot`。
- `source_health` 必须能看到 `status`、`last_success_at`、`last_error_at`、`last_error_text`、`fallback_used`、`last_latency_ms`。
- runtime topic refresh 默认每小时跑一次；成功时写入新的 `runtime_topic_seeds` 快照，失败时保留上一份 active snapshot。
- 当 active runtime topic snapshot 缺失或过期时，collect 会回退到 `topics` catalog 做动态查询扩展。
- `pnpm db:reset` 会把数据库恢复到可立即运行的 schema 基线；若本地 schema 落后，不需要额外手动补跑 migration。

traceability 的核验点：

- `item_sources.source_run_id` 必须关联当前采集尝试对应的 `source_runs.id`。
- `item_sources.snapshot_id` 在 live success 时指向本轮新写入的 `raw_snapshots.id`，fallback 时指向被复用的历史 `raw_snapshots.id`。
- `/question-clusters/:clusterId/evidence` 必须直接返回 `sourceRunId` 和 `snapshotId`。

时间字段规则：

- `publishedAt` 优先来自源站时间字段。
- 当源站不给发布时间时，`publishedAt` 回退到 `collectedAt`，同时 `timestampOrigin = "collected"`。
- 依赖 freshness / novelty 的逻辑一律读取 `publishedAt`，不要把 `collectedAt` 当成真实发布时间。

## 种子数据

仓库默认写入一批用于演示的 watchlists 与 topic/entity catalog，用于 Phase 0 + Phase 1 的匹配与 demo。

动态 topic 说明：

- 本阶段不再维护本地 seed JSON 文件。
- 稳定兜底 seed 保存在 `topics` / `entities`。
- runtime topic discovery 结果只存数据库：`runtime_topic_seed_runs` 和 `runtime_topic_seeds`。
- runtime topic 的主发现源是 OSSInsight `collections` / `hot-collections`，DEV `top` tags 只做辅助补充。
