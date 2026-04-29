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

## 验证方式

- Pipeline 集成测试： [pipeline.test.ts](../../test/apps/worker/pipeline.test.ts)
