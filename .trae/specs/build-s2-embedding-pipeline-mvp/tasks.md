# Tasks
- [x] Task 1: 设计并落地 embedding 数据契约与配置基线（`packages/contracts` + `packages/config`）。
  - [x] SubTask 1.1: 在 `packages/contracts/src/index.ts` 增加 embedding record DTO（含 provider/model/version/fingerprint/status/vector/metadata）。
  - [x] SubTask 1.2: 在 `packages/config/src/index.ts` 增加 embedding provider 配置项（支持 Ollama 默认配置与超时控制）。
  - [x] SubTask 1.3: 明确模型版本与输入 schema 版本字段，保证重算可追踪。

- [x] Task 2: 新增 embedding 持久化 schema 与 repository（`packages/db`）。
  - [x] SubTask 2.1: 在 `packages/db/migrations` 新增 embedding 表、状态字段、唯一约束与 pgvector 索引。
  - [x] SubTask 2.2: 在 `packages/db/src/repository.ts` 增加 embedding upsert/list/backfill 查询与状态更新方法。
  - [x] SubTask 2.3: 落地 `source + fingerprint + model + inputSchemaVersion` 去重策略与 superseded 标记策略。

- [x] Task 3: 增加 domain embedding 输入拼装器与 guard（`packages/domain`）。
  - [x] SubTask 3.1: 新增 deterministic input builder，定义字段拼装顺序与归一化规则。
  - [x] SubTask 3.2: 新增禁止字段 guard（排除 rawMeta、legacy refs、运行时噪声字段）。
  - [x] SubTask 3.3: 为输入文本生成 input fingerprint，供 repository/worker 复用。

- [x] Task 4: 在 worker 打通 embedding 增量/回填/重算作业（`apps/worker`）。
  - [x] SubTask 4.1: 扩展 `apps/worker/src/jobs/definitions.ts`，新增 embedding 与 embedding-backfill job 定义。
  - [x] SubTask 4.2: 扩展 `apps/worker/src/services/pipeline.ts`，接入 provider 调用、持久化、失败降级与日志。
  - [x] SubTask 4.3: 确保 provider 失败只影响 embedding 任务，不中断现有 question pressure 主链路。

- [x] Task 5: 完成测试与验收（domain/db/worker）。
  - [x] SubTask 5.1: 增加 embedding input builder 单测（字段拼装、排除规则、fingerprint 稳定性）。
  - [x] SubTask 5.2: 增加 repository 持久化测试（幂等 upsert、去重、重算状态）。
  - [x] SubTask 5.3: 增加 worker job 集成测试（增量、回填、provider mock 失败降级）。
  - [x] SubTask 5.4: 回归验证 `feed/question-pressure/evidence` 路由无破坏。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2, Task 3 and Task 4
