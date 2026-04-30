# apps/worker（BullMQ 编排与任务）

## 职责

- 调度与执行 Phase 0 + Phase 1 的异步作业（BullMQ）
- 编排 sources -> domain -> db 的数据管道
- 产出可被 `apps/api` 读取的持久化数据与缓存

## 边界与禁止项

- 不实现鉴权、计费、配额
- 不在 worker 内发明新的 domain 规则（决策逻辑归 `packages/domain`）
- 不接入 GitHub API / GH Archive

## 关键入口

- Worker 启动入口： [worker.ts](./src/worker.ts)
- Pipeline 编排： [pipeline.ts](./src/services/pipeline.ts)
- Job 定义： [definitions.ts](./src/jobs/definitions.ts)

## 数据源与合约

- OpenCLI 审计与采集：`packages/sources`
- DB 访问：`packages/db`

## 日志与可观测性

- worker 使用结构化 JSON 行日志，输出到仓库根目录：`logs/worker.YYYY-MM-DD.N.log`（由 `pino-roll` 自动滚动）
- 日志覆盖：
  - worker 启动、scheduler 注册、bootstrap enqueue
  - 全队列 job 的 `start/success/fail`
  - pipeline 关键阶段：抓取、PG 持久化、Redis 缓存失效、runtime topic refresh
- 日志字段包含：`timestamp`、`level`、`event`、`context`（如 `queue/jobId/source/durationMs`）

## 验证方式

- Pipeline 集成测试： [pipeline.test.ts](../../test/apps/worker/pipeline.test.ts)
- `pnpm db:reset` 后不应留下缺表状态；schema 应能直接支撑 worker 首轮启动
- worker 冷启动不应只能等待下一次 cron；当 runtime topic snapshot 或持久化内容缺失时，应能通过 bootstrap enqueue 恢复首轮采集
