# DevTrend Cloud：Phase 2+ 阶段性开发拆解（2026-05-05）

本文件是 [devtrend-cloud-practical-plan-2026-05-05-v5.md](./devtrend-cloud-practical-plan-2026-05-05-v5.md) 的执行拆解版。

目标不是再写一份“大而全 roadmap”，而是把后续开发切成可以被 Agent 单独读取、单独生成 spec、单独实现和单独验收的阶段包。

## 使用方式

后续不要让 Agent 一次性实现 `v5` 全部任务，而是遵循下面的节奏：

1. 一次只选择一个执行阶段（`S1`、`S2` ...）。
2. Agent 先只读取本文件 + `v5` 计划 + 相关包级 AGENTS。
3. 仅针对当前阶段生成 spec 文档。
4. spec 通过后，再进入该阶段实现。
5. 当前阶段验收通过后，才进入下一个阶段。

## 设计原则

- 阶段拆分要遵守“先底座，后语义，最后交付”的顺序。
- 每个阶段都必须在现有代码结构上增量演进，不能推倒重来。
- 每个阶段都要有独立的测试口径与出阶段门槛。
- 没有进入当前阶段范围的功能，不应被顺手实现。
- `watchlist / digest / webhook` 必须继续后置，不能插队到 Topic Layer 前面。

## 全局约束

### 不变约束

- 数据源仍限于公开、无需登录态的 sources。
- `GitHub` 在当前路线里仍然指 `OSSInsight-backed GitHub adoption proxy`。
- 核心决策继续坚持 `rule-first + embedding-assisted`。
- LLM 只负责 naming / summary / suggestion，不负责最终业务评分。
- 所有阶段都不能破坏现有 `question pressure` 主链路。

### 全局完成定义

只有当某阶段同时满足下面四类条件，才能进入下一阶段：

- schema / migration / contract 已稳定
- worker 管道可运行或可模拟运行
- 测试与文档已同步
- 对现有 `feed / question-pressure / evidence` 无回归破坏

## 阶段地图

```text
S1 统一内容模型与 Feature Schema 基线
S2 Embedding Pipeline MVP
S3 Topic Clustering MVP
S4 Topic Naming + Taxonomy MVP
S5 Topic Read API + Read Console MVP
S6 Insight Read Model MVP
S7 Watchlist / Digest / Webhook 验证阶段
```

说明：

- `S1-S4` 是 Topic Layer 主线。
- `S5-S6` 是 Topic Layer 之上的 read model 与 insight 层。
- `S7` 才进入订阅交付与商业验证。

---

## S1：统一内容模型与 Feature Schema 基线

### 阶段目标

把当前 `items + raw_meta + source-specific normalize` 的实现，提升为后续 embedding / topic clustering 可以稳定消费的统一内容模型与特征层基线。

### 为什么先做这个阶段

如果没有统一模型，后面的 embedding、cluster、taxonomy 都会绑定在 source-specific payload 上，最终导致：

- 不同来源之间无法稳定比较
- topic cluster 的输入质量不一致
- 后续 schema/migration 反复返工

### 当前阶段范围

- 定义 unified content record
- 定义 source-specific feature schema
- 明确 question layer 与 topic layer 对输入数据的边界
- 补足 repository / contract / DB 的基础对象设计
- 让 worker 能在不破坏旧流程的情况下输出统一模型数据

### 不在本阶段做

- embedding 生成
- topic clustering
- LLM naming
- topic API
- web 新页面

### 主要改动面

- `packages/contracts/src/index.ts`
- `packages/db/migrations/*`
- `packages/db/src/repository.ts`
- `packages/domain/src/*`（新增 unified content / feature types）
- `packages/sources/src/normalizers/*`
- `apps/worker/src/services/pipeline.ts`
- `apps/worker/src/jobs/definitions.ts`

### 预期交付物

- 统一内容模型文档
- feature schema 文档
- 对应 migration 草案
- repository read/write helpers
- worker 中统一模型写入路径
- 与现有 `items` / `item_sources` 的兼容策略说明

### Agent 生成 spec 时必须回答的问题

- unified content record 是否是新表、物化视图、还是在现有 `items` 上扩展？
- `source_features` 如何按 source 分层，同时保持共享 schema？
- question layer 继续读什么对象，topic layer 读什么对象？
- 如何避免对现有 API 造成破坏？

### 测试要求

- contract/schema 测试
- repository 测试
- normalizer 测试
- pipeline 集成测试
- migration 可执行性验证

### 出阶段门槛

- HN / SO / DEVTO / OSSInsight proxy 三类输入都能映射到统一模型
- 新模型不会破坏现有 `question pressure` 结果读取
- DB schema 与 contract 已足够支撑 `S2`

---

## S2：Embedding Pipeline MVP

### 阶段目标

引入可重算、可追踪、可逐步回填的 embedding 生成能力，为 Topic Layer 提供稳定的向量召回基础。

### 当前阶段范围

- 设计 embedding record
- 设计 embedding job / backfill job
- 定义 embedding 输入拼装规则
- 确定 pgvector 存储与索引策略
- 打通 worker 中 embedding 生成与持久化链路

### 不在本阶段做

- topic clustering 最终业务规则
- taxonomy 生成
- insight API

### 主要改动面

- `packages/config/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/db/migrations/*`
- `packages/db/src/repository.ts`
- `packages/domain/src/*`（embedding input builder / guards）
- `apps/worker/src/jobs/definitions.ts`
- `apps/worker/src/services/pipeline.ts`

### 预期交付物

- embedding record 持久化对象
- embedding 生成 job
- embedding 回填策略
- embedding 重算策略
- 基于 source + content fingerprint 的去重策略

### Agent 生成 spec 时必须回答的问题

- embedding provider / model 是否可配置？
- 输入字段如何拼装，哪些字段绝不进入 embedding？
- 何时触发重算？内容变更、schema 变更还是模型版本变更？
- 如何在 provider 不可用时保证主链路不崩？

### 测试要求

- embedding input builder 单测
- repository 持久化测试
- worker job 集成测试
- provider mock 测试
- 无 embedding 时的降级行为测试

### 出阶段门槛

- 统一模型数据可以生成 embedding 并落库
- 支持增量与回填
- provider 失败不会破坏已有 question pipeline
- 已为 `S3` 准备好可查询向量数据

---

## S3：Topic Clustering MVP

### 阶段目标

在现有 question clustering 之外，建立面向主题语义的动态 topic clustering 能力。

### 当前阶段范围

- 定义 topic cluster 对象与 membership
- 设计 embedding-assisted + rule-first 的聚类策略
- 定义 merge / split / dedupe guardrails
- 设计 representative evidence 选取规则
- 让 worker 可以产出可查询 topic clusters

### 不在本阶段做

- LLM 自动命名
- taxonomy L1/L2/L3
- topic read API

### 主要改动面

- `packages/contracts/src/index.ts`
- `packages/db/migrations/*`
- `packages/db/src/repository.ts`
- `packages/domain/src/topics/*`（建议新增）
- `packages/domain/src/index.ts`
- `apps/worker/src/services/pipeline.ts`
- `test/packages/domain/*`
- `test/apps/worker/*`

### 预期交付物

- topic cluster schema
- cluster job
- membership 持久化
- representative evidence 计算规则
- cluster QA 抽样规则

### Agent 生成 spec 时必须回答的问题

- topic cluster 与 question cluster 的关系是并行、派生还是部分复用？
- cluster 是批处理、增量更新，还是混合模式？
- merge guardrails 具体依赖哪些规则：embedding、tags、repo、entity、source overlap、time window？
- 如何定义 cluster 稳定性，避免 cluster id 频繁抖动？

### 测试要求

- cluster rule 单测
- cross-source merge 回归测试
- cluster stability 回归测试
- pipeline 集成测试
- representative evidence 选择测试

### 出阶段门槛

- 能稳定生成 topic clusters，而不只是单条 item 分桶
- 至少有可解释的 representative evidence 与 source mix
- cluster id 与 membership 在重复运行时具备稳定性
- 结果质量足以支撑 `S4` naming

---

## S4：Topic Naming + Taxonomy MVP

### 阶段目标

在已有 topic clusters 基础上，为 cluster 生成可读 label，并归并出一级、二级、三级主题树。

### 当前阶段范围

- 定义 topic label candidate
- 定义 LLM prompt 输入与输出 contract
- 定义 naming validation / fallback 规则
- 定义 taxonomy node、topic lineage、topic membership
- 让 taxonomy 产物可追溯、可审计、可重算

### 不在本阶段做

- 对外 topic API
- insight scoring
- watchlist/digest

### 主要改动面

- `packages/contracts/src/index.ts`
- `packages/db/migrations/*`
- `packages/db/src/repository.ts`
- `packages/domain/src/topics/*`
- `packages/config/src/index.ts`
- `apps/worker/src/jobs/definitions.ts`
- `apps/worker/src/services/pipeline.ts`

### 预期交付物

- topic label candidate 对象
- naming job
- taxonomy node / lineage 持久化
- naming fallback 机制
- taxonomy review 规则文档

### Agent 生成 spec 时必须回答的问题

- label candidate 与 canonical topic 的关系是什么？
- taxonomy 是完全自动归并，还是“自动建议 + deterministic guardrails”？
- 当 LLM 命名失败或输出低质量时，fallback 是什么？
- 如何保留 evidence traceability，使 taxonomy 不是黑盒？

### 测试要求

- LLM output parser / validator 测试
- fallback 测试
- taxonomy merge rule 测试
- persistence 测试
- 命名结果抽样评审口径文档

### 出阶段门槛

- 每个 topic cluster 至少有可用 label 或 fallback label
- 能归并出第一版 L1/L2/L3 taxonomy
- taxonomy 输出可追溯到 cluster 与 evidence
- Topic Layer 资产已经可供 API 层消费

---

## S5：Topic Read API + Read Console MVP

### 阶段目标

把 Topic Layer 从内部产物变成可读、可浏览、可验证的对外只读模型。

### 当前阶段范围

- 新增 topic read APIs
- topic evidence drilldown
- web 端新增 topic list / topic detail 页面
- 在 UI 中展示 topic label、keywords、source mix、related repos / entities

### 不在本阶段做

- insight scoring 的完整决策层
- watchlist CRUD
- digest / webhook

### 主要改动面

- `packages/contracts/src/index.ts`
- `packages/db/src/repository.ts`
- `apps/api/src/routes/index.ts`
- `apps/api/src/services/*`
- `apps/web/src/features/*`（建议新增 `topics/`）
- `docs/api.md`

### 预期交付物

- `GET /topics`
- `GET /topics/:topicId`
- `GET /topics/:topicId/evidence`
- web topic 列表页
- web topic 详情页

### Agent 生成 spec 时必须回答的问题

- topic list 的排序依据是什么：freshness、volume、emerging score、mixed score？
- topic detail 页与 evidence 页如何分页与筛选？
- 如何让 topic 页面与现有 question pressure 页面形成关联而不是重复？
- API 是否需要 cursor 分页与统一 meta？

### 测试要求

- API route 集成测试
- repository 查询测试
- web 交互测试或组件测试
- 端到端数据链路手工验证

### 出阶段门槛

- 用户可以从 API 和 web 浏览 Topic Layer 资产
- topic read model 与现有 `question pressure` 路由共存且无冲突
- Topic Layer 已经具备基本可演示性

---

## S6：Insight Read Model MVP

### 阶段目标

基于 Topic Layer 建立第一批“更接近决策”的 insight read models，而不是继续停留在 raw data/feed 层。

### 当前阶段范围

- 定义 emerging topic read model
- 定义 cross-source resonance read model
- 定义 adoption evidence by topic read model
- 设计 insight 计算规则与可解释字段

### 不在本阶段做

- watchlist / digest
- webhook delivery
- account / billing

### 主要改动面

- `packages/contracts/src/index.ts`
- `packages/db/src/repository.ts`
- `packages/domain/src/scoring/*` 或 `src/insights/*`（建议新增）
- `apps/api/src/routes/index.ts`
- `apps/web/src/features/*`（可选新增 `insights/`）
- `docs/api.md`

### 预期交付物

- `GET /insights/topic-emerging`
- `GET /insights/topic-cross-source`
- `GET /topics/:topicId/adoption-evidence`
- 对应评分解释字段与 evidence drilldown

### Agent 生成 spec 时必须回答的问题

- 每个 insight 的 deterministic inputs 是什么？
- 哪些字段可以由规则生成，哪些只能作为展示摘要？
- 如何避免 insight 结果退化成“换个名字的 feed 排序”？
- 与现有 `question pressure` 的关系如何表达？

### 测试要求

- scoring / ranking 单测
- repository query 测试
- API 集成测试
- 至少 3 个 demo topics 的手工验收报告

### 出阶段门槛

- Insight API 输出已经具备可解释性
- 可以围绕 topic 产出“我该关注什么”的第一层业务语义
- 足以支撑 `S7` 的订阅交付验证

---

## S7：Watchlist / Digest / Webhook 验证阶段

### 阶段目标

在 Topic Layer 与 Insight Read Model 已稳定的前提下，再引入订阅交付与外部验证能力。

### 当前阶段范围

- watchlist CRUD
- digest grouping
- webhook delivery
- 外部试用验证

### 为什么必须后置

如果在 Topic Layer 还不稳定时就做 watchlist / digest：

- 用户只能收到“更花哨的 feed”
- 交付层会固化错误语义
- 商业验证会被低质量主题资产拖累

### 主要改动面

- `packages/contracts/src/index.ts`
- `packages/db/src/repository.ts`
- `apps/api/src/routes/index.ts`
- `apps/worker/src/services/pipeline.ts`
- `apps/web/src/features/*`
- 通知/交付相关 worker jobs

### Agent 生成 spec 时必须回答的问题

- watchlist 是基于 topic、entity、repo 还是 mixed rules？
- digest 的 grouping 规则如何定义？
- webhook payload 如何保留 insight 与 evidence 语义？
- 哪些用户动作算作“真正采用而不是浏览”？

### 测试要求

- CRUD API 测试
- digest grouping 测试
- webhook payload contract 测试
- 试用反馈记录模板

### 出阶段门槛

- 用户能稳定收到 topic / insight 驱动的摘要
- digest 至少能驱动 docs / content / roadmap / competitor watch 动作中的一种
- 具备继续进入商业化功能层的证据

---

## 每阶段都要产出的 spec 结构

Agent 后续为任一阶段生成 spec 时，建议统一产出以下文档结构：

1. `spec.md`
   - 背景与目标
   - 当前状态
   - 范围 / 非范围
   - 关键决策
   - 数据模型 / API / worker 设计
   - 失败模式与回退策略
   - 验收标准
2. `tasks.md`
   - 按包拆分的实现任务
   - 按先后顺序排列
   - 每项任务标注依赖关系
3. `checklist.md`
   - migration
   - tests
   - docs sync
   - regression checks
   - manual QA

## Agent 执行约束

后续让 Agent 执行时，建议在提示词中明确：

- 一次只做一个阶段
- 先生成 spec，不直接编码
- 不补做后续阶段功能
- 必须写明受影响的具体包与文件面
- 必须给出测试方案、验收门槛与回滚思路

## 推荐执行顺序

推荐严格按以下顺序推进：

1. `S1` 统一内容模型与 Feature Schema 基线
2. `S2` Embedding Pipeline MVP
3. `S3` Topic Clustering MVP
4. `S4` Topic Naming + Taxonomy MVP
5. `S5` Topic Read API + Read Console MVP
6. `S6` Insight Read Model MVP
7. `S7` Watchlist / Digest / Webhook 验证阶段

不要跳步。

如果只能先做一个阶段，优先做 `S1`。
