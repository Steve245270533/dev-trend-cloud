# apps/worker（BullMQ 编排与任务）

## 职责

- 调度与执行当前的异步作业（BullMQ）
- 编排 `sources -> domain -> db` 的数据管道
- 产出可被 `apps/api` 与 `apps/web` 读取的持久化数据与缓存
- 为下一阶段的 Feature Layer / Topic Layer jobs 提供编排承载

## 当前已实现

- topic seed refresh
- contract audit
- source collect / fallback / source health rollup
- normalize / match / question cluster / score
- embedding incremental / backfill（provider 调用 + 持久化 + 失败降级日志）
- topic clustering incremental / backfill（cluster 持久化 + membership 更新 + supersede）
- dynamic-cluster-first runtime topic loading（低置信度或异常时回退到 runtime seeds）
- bootstrap enqueue on cold start

## 下一阶段目标

- topic naming jobs（LLM-assisted）
- topic persistence / taxonomy jobs

## 边界与禁止项

- 不实现鉴权、计费、配额
- 不在 worker 内发明新的 domain 规则（决策逻辑归 `packages/domain`）
- 不接入 direct GitHub API / GH Archive
- LLM 只参与 topic naming / summary，不直接裁决核心评分

## 关键入口

- Worker 启动入口： [worker.ts](./src/worker.ts)
- Pipeline 编排： [pipeline.ts](./src/services/pipeline.ts)
- Source Breaker Store： [source-breaker.ts](./src/services/source-breaker.ts)
- Job 定义： [definitions.ts](./src/jobs/definitions.ts)
- Worker 导出入口： [index.ts](./src/index.ts)

## 数据源与合约

- OpenCLI 审计与采集：`packages/sources`
- DB 访问：`packages/db`

## 日志与可观测性

- worker 使用结构化 JSON 行日志，输出到仓库根目录：`logs/worker.YYYY-MM-DD.N.log`（由 `pino-roll` 自动滚动）
- 日志覆盖：
  - worker 启动、scheduler 注册、bootstrap enqueue
  - 全队列 job 的 `start/success/fail`
- pipeline 关键阶段：抓取、PG 持久化、Redis 缓存失效、runtime topic refresh
- pipeline 关键阶段额外要求：
  - collect / topic discovery 使用 Redis-backed circuit breaker
  - audit job 绕过 breaker
  - hard fail 且无 fallback snapshot 时只更新 health，不清空历史 source items
  - runtime topic 主判定优先读取动态 topic clusters；仅在 `low-confidence`、`insufficient-keywords`、`candidate-conflict`、`embedding-missing`、`worker-error` 等场景回退到 runtime seeds

## 验证方式

- Pipeline 集成测试： [pipeline.test.ts](../../test/apps/worker/pipeline.test.ts)
- `pnpm db:reset` 后不应留下缺表状态；schema 应能直接支撑 worker 首轮启动
- worker 冷启动不应只能等待下一次 cron；当 runtime topic snapshot 或持久化内容缺失时，应能通过 bootstrap enqueue 恢复首轮采集
- Topic clustering QA 抽样至少检查 representative evidence、source mix、cluster stability 与 runtime fallback case
