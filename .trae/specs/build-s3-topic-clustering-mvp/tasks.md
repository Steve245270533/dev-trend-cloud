# Tasks
- [x] Task 1: 明确 `S3` 的 topic cluster 边界与实现入口（`packages/contracts` + `packages/domain`）。
  - [x] SubTask 1.1: 定义 `topic cluster`、`membership`、`representative evidence`、`source mix` 的 DTO 与版本字段。
  - [x] SubTask 1.2: 明确 `topic clusters` 与 `question clusters` 的关系，保持并行建模而非替换。
  - [x] SubTask 1.3: 明确动态 cluster 主判定与固定 allowlist fallback 的边界、触发条件与日志字段。

- [x] Task 2: 新增 topic clustering 持久化 schema 与 repository（`packages/db`）。
  - [x] SubTask 2.1: 在 `packages/db/migrations` 增加 topic cluster 主表、membership 表及必要索引与唯一约束。
  - [x] SubTask 2.2: 在 `packages/db/src/repository.ts` 增加 cluster upsert、membership 写入、evidence 查询与 superseded 标记方法。
  - [x] SubTask 2.3: 补充稳定 ID、版本字段与 fallback reason 的持久化支持，保证重复运行可追踪。

- [x] Task 3: 实现 deterministic topic clustering 规则（`packages/domain/src/topics/*`）。
  - [x] SubTask 3.1: 实现 embedding candidate retrieval 之后的 merge guardrails，综合 tags、entities、repos、source overlap、time window 与文本特征。
  - [x] SubTask 3.2: 实现 split、dedupe、cluster anchor 与稳定 ID 规则，降低 cluster 抖动。
  - [x] SubTask 3.3: 实现 representative evidence、source mix、related repos/entities 的计算规则。

- [x] Task 4: 在 worker 接入增量与回填 clustering 作业（`apps/worker`）。
  - [x] SubTask 4.1: 扩展 `apps/worker/src/jobs/definitions.ts`，新增 topic clustering 与 topic clustering backfill job。
  - [x] SubTask 4.2: 扩展 `apps/worker/src/services/pipeline.ts`，从 unified content + embeddings 触发 cluster 生成、更新与 supersede。
  - [x] SubTask 4.3: 在 runtime topic 判定中切换为“动态 cluster 优先，固定 allowlist fallback”，并记录 fallback reason。

- [x] Task 5: 完成 `S3` 回归测试与质量验证（domain/db/worker）。
  - [x] SubTask 5.1: 增加 cluster rule 单测，覆盖 merge reject、split、dedupe、stability 与 representative evidence 选择。
  - [x] SubTask 5.2: 增加 cross-source merge 回归测试，验证 HN / DEV / OSSInsight proxy 能被合理聚合。
  - [x] SubTask 5.3: 增加 repository 与 worker 集成测试，覆盖增量入簇、回填重跑、fallback 与 superseded 版本。
  - [x] SubTask 5.4: 回归验证 `feed/question-pressure/evidence` 路由行为不变，且动态 topic 主判定迁移完成。

- [x] Task 6: 同步 `S3` 文档与人工 QA 口径。
  - [x] SubTask 6.1: 更新相关架构或包级文档，注明 topic cluster schema、运行模式与 fallback 边界。
  - [x] SubTask 6.2: 补充 cluster QA 抽样口径，至少覆盖 representative evidence、source mix、cluster stability 与 fallback case。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2, Task 3 and Task 4
- Task 6 depends on Task 4 and Task 5
