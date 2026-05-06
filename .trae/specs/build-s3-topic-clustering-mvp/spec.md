# S3 Topic Clustering MVP Spec

## Why
`S2` 已经提供可重算、可追踪的 embedding 输入与持久化能力，但系统当前仍主要依赖 `question clustering` 与固定 allowlist 组织语义，尚未沉淀可复用的动态 topic 资产。本阶段需要建立 `topic clustering` 主链路，把跨来源内容聚合为稳定、可解释、可查询的主题簇，同时将固定 allowlist 从主判定降级为安全兜底。

## What Changes
- 新增 `topic cluster`、`topic cluster membership` 与 `representative evidence` 数据对象，用于持久化动态主题聚类结果。
- 新增 `packages/domain/src/topics/*` 的确定性聚类规则，采用 `embedding-assisted + rule-first` 模式，先召回候选，再用 tags、entities、repos、source overlap、time window 等 guardrails 决定是否合并。
- 新增 cluster stability 机制，定义 cluster anchor、稳定 ID、merge/split/dedupe 约束，降低重复运行时的 cluster id 抖动。
- 新增 representative evidence 与 source mix 计算规则，保证每个 cluster 都有可追溯的代表样本，而不是只输出抽象分桶。
- 新增 worker topic clustering 增量任务与批处理回填任务，支持从 `S2` 的 embedding 记录和 unified content 中生成 topic clusters。
- 修改 runtime topic 主判定路径：优先使用动态 topic clustering 结果，固定 allowlist 仅在低置信度、无 cluster 命中或异常场景下作为 fallback。
- 保持 `question clusters` 并行存在，继续服务 `question pressure`，不被 `topic clusters` 直接替换。

## Impact
- Affected specs: embedding-pipeline-foundation, topic-layer-clustering, runtime-topic-adjudication
- Affected code:
  - `packages/contracts/src/index.ts`
  - `packages/db/migrations/*`
  - `packages/db/src/repository.ts`
  - `packages/domain/src/topics/*`
  - `packages/domain/src/index.ts`
  - `apps/worker/src/jobs/definitions.ts`
  - `apps/worker/src/services/pipeline.ts`
  - `test/packages/domain/*`
  - `test/packages/db/*`
  - `test/apps/worker/*`

## ADDED Requirements
### Requirement: Topic Cluster 与 Membership 持久化
系统 SHALL 为动态 topic clustering 提供独立于 `question clusters` 的持久化对象，至少包含 cluster 主对象、membership、代表性证据、source mix 与相关 repo/entity 摘要字段。

#### Scenario: 持久化跨来源 cluster
- **WHEN** worker 对同一时间窗口内的 unified content 执行 topic clustering
- **THEN** 系统为每个有效 cluster 写入稳定的 `topic_cluster_id`
- **AND** 为 cluster 成员写入 membership 记录，记录 item、embedding、置信度、primary evidence 标记与版本信息

### Requirement: Embedding-Assisted + Rule-First 聚类决策
系统 SHALL 先使用 embedding 相似度召回候选内容，再使用确定性 guardrails 完成 merge/split/dedupe 判定；embedding 不能单独决定最终 cluster merge。

#### Scenario: 候选内容被允许合并
- **WHEN** 两条来自不同 source 的 unified content 在向量空间中相近
- **THEN** 系统继续校验 tags、entities、repos、source overlap、time window、文本特征等 deterministic 条件
- **AND** 仅在达到最小 guardrail 阈值时才允许进入同一 topic cluster

#### Scenario: 高向量相似但语义不一致
- **WHEN** embedding 候选命中，但 repo/entity 或时间窗口明显冲突
- **THEN** 系统拒绝自动合并
- **AND** 为该候选打上 merge rejected 或 split required 标记，供后续 QA 抽样

### Requirement: Topic Cluster 与 Question Cluster 并行建模
系统 SHALL 将 `topic clusters` 与现有 `question clusters` 视为并行对象：前者服务主题语义沉淀，后者继续服务问题信号压缩与 pressure 计算。

#### Scenario: 同一 item 同时属于 question cluster 与 topic cluster
- **WHEN** 某条内容已参与现有 `question clustering`
- **THEN** 该内容仍可被纳入一个或多个 topic clustering 候选流程
- **AND** `question pressure` 的读取与计算契约保持不变，不依赖 `topic clusters` 才能工作

### Requirement: Cluster Stability 与 ID 生命周期
系统 SHALL 为 topic cluster 定义稳定 ID 生成与生命周期规则，避免在重复运行、增量补数或局部 membership 变化时频繁更换 cluster id。

#### Scenario: 重复运行同一窗口
- **WHEN** worker 以相同输入数据和相同规则版本重复执行 clustering
- **THEN** 已存在 cluster 优先复用原有 `topic_cluster_id`
- **AND** 仅更新 membership、统计字段与 evidence 排名，而不是无条件创建新 cluster

#### Scenario: 增量内容扩展已有 cluster
- **WHEN** 新内容命中现有 cluster 的 anchor 与 guardrails
- **THEN** 系统将其加入现有 cluster
- **AND** 保留原 cluster id，不因 cluster size 变化而重编号

### Requirement: Representative Evidence 与 Source Mix 可解释
系统 SHALL 为每个 topic cluster 计算代表性证据与 source mix，保证 cluster 结果可以被审计和人工抽样评估。

#### Scenario: 选择代表性证据
- **WHEN** 一个 cluster 内包含多条候选 item
- **THEN** 系统按覆盖不同 source、较高 membership 置信度、新鲜度与内容完整度选择代表性 evidence
- **AND** 至少保留一个可追溯 primary evidence 与若干 supporting evidence

### Requirement: Mixed Mode Clustering Jobs
系统 SHALL 同时支持增量 clustering 与批处理回填，保证新内容可快速入簇，历史内容可按规则版本或窗口范围重跑。

#### Scenario: 新内容到达后增量入簇
- **WHEN** worker 发现存在新 embedding 且满足最小输入条件
- **THEN** 触发增量 clustering job 对候选 cluster 进行扩展或创建

#### Scenario: 规则版本变化后批量重跑
- **WHEN** clustering rule version、merge threshold 或 evidence ranking 策略变化
- **THEN** 系统支持按时间窗口或批次触发 backfill clustering
- **AND** 可以区分新旧运行结果与 superseded cluster 版本

### Requirement: Runtime Topic 主判定迁移到动态聚类
系统 SHALL 在运行时 topic 判定中优先使用动态 topic clustering 结果，固定 allowlist 只保留为安全 fallback，而不是主路径。

#### Scenario: 正常命中动态 cluster
- **WHEN** 新内容在 runtime topic 判定阶段成功命中高置信度 topic cluster
- **THEN** 系统将该 cluster 结果作为主判定输出
- **AND** 不再以固定 allowlist 作为第一优先级语义来源

#### Scenario: 触发 fallback
- **WHEN** embedding 缺失、cluster 置信度不足、候选冲突未决或运行异常
- **THEN** 系统允许回退到固定 allowlist 或现有安全规则
- **AND** 明确记录 fallback reason，便于风险控制与后续迁移收敛

## MODIFIED Requirements
### Requirement: Runtime Topic Discovery 判定顺序
系统 SHALL 将运行时 topic 判定顺序调整为“动态 cluster 结果优先，固定 allowlist 兜底”，同时保留现有 `question pressure`、`feed` 与 `evidence` 读取路径不变。

## REMOVED Requirements
### Requirement: 固定 Allowlist 作为 Runtime Topic 主判定
**Reason**: 固定词表只能作为过渡期 guardrail，无法支撑跨来源动态语义聚合，也会阻碍后续 `S4` 的 naming 与 taxonomy 收敛。
**Migration**: 在 `S3` 中保留固定 allowlist，但仅在无 cluster 命中、低置信度或异常场景下触发 fallback，并对所有 fallback 原因进行可观测记录。
