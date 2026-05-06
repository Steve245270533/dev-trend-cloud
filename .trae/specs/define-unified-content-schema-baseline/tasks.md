# Tasks
- [x] Task 1: 明确统一模型与边界契约：定义 unified content record、source_features 分层规则，以及 Question/Topic layer 读取边界。
  - [x] SubTask 1.1: 在 `packages/contracts` 增加统一内容与 feature schema DTO
  - [x] SubTask 1.2: 在 `packages/domain` 增加 unified content 与 feature 类型及校验器
  - [x] SubTask 1.3: 输出兼容策略说明（`items/item_sources` 与 unified model 的映射）

- [x] Task 2: 落地数据库与仓储基线：为统一模型设计 migration 并补齐 repository 读写 helper。
  - [x] SubTask 2.1: 在 `packages/db/migrations` 增加 unified model 相关表/字段迁移草案
  - [x] SubTask 2.2: 在 `packages/db/src/repository.ts` 增加统一模型写入与读取 helper
  - [x] SubTask 2.3: 增加回滚与兼容检查点（确保不破坏旧查询）

- [x] Task 3: 接入 normalizer 与 worker 写入路径：让多源输入可写入统一模型，同时保持旧流程可用。
  - [x] SubTask 3.1: 更新 `packages/sources/src/normalizers/*` 输出统一字段与 source_features
  - [x] SubTask 3.2: 更新 `apps/worker/src/services/pipeline.ts` 写入统一模型（旁路或双写）
  - [x] SubTask 3.3: 更新 `apps/worker/src/jobs/definitions.ts` 的任务定义与上下游数据契约

- [x] Task 4: 完成测试与验证：覆盖 contract、repository、normalizer、pipeline 与 migration 可执行性。
  - [x] SubTask 4.1: 增加/更新 contract/schema 测试
  - [x] SubTask 4.2: 增加/更新 repository 测试与 migration 执行验证
  - [x] SubTask 4.3: 增加/更新 normalizer 与 pipeline 集成测试（覆盖 HN/SO/DEVTO/OSSInsight proxy）
  - [x] SubTask 4.4: 回归验证现有 `question pressure` 读取结果不变

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
