# DevTrend Cloud：Topic Layer 优先的开发计划 v5

收敛时间：2026-05-05  
版本定位：基于 `review-2026-05-05.md` 的商业化复盘，以及仓库当前真实实现状态，对 `2026-04-29 v4` 的后续阶段重排版

## 一句话结论

DevTrend Cloud 当前已经跑通 `Phase 0 + Phase 1` 的采集、归一化、question pressure 与 evidence drilldown 主链路，但离“可卖的 Dev Intelligence 产品”还差一层关键能力：

> Feature Layer + Topic Layer。

因此从今天开始，后续开发不再先做 `watchlist / digest / webhook`，而是先做：

```text
统一模型 -> embedding -> topic clustering -> LLM topic naming -> topic persistence -> hierarchical taxonomy
```

## 本版为什么重排路线

`docs/reports/review-2026-05-05.md` 的核心判断是：

- 当前 API 还是“数据访问层”，还不是“决策接口”。
- 当前 worker 还是“ETL + 基础清洗”，还不是“Feature Engineering + Topic Layer”。
- 如果先做静态标准词库、watchlist、digest，只会把当前能力包装得更像一套采集系统，而不是形成真正的产品壁垒。

因此 v5 把 Phase 2 调整为：

```text
Dynamic Topic Layer / Feature Layer MVP
```

而不是 `watchlist / digest`。

## 当前仓库真实状态（2026-05-05）

### 已实现

- monorepo、`pnpm workspace`、`TypeScript + SWC`
- Fastify 只读 API
- BullMQ worker 编排
- Postgres + Redis 持久化与缓存
- OpenCLI contract audit 与 public source collectors
- Stack Overflow / Hacker News / DEV / OSSInsight 归一化管道
- runtime topic discovery（OSSInsight collections / hot-collections + DEV top tags）
- rule-first 的 topic/entity matching
- question extraction、question clustering、question pressure scoring
- evidence drilldown 与 source health 元数据
- 轻量只读 web console（用于浏览 pressure / cluster / evidence / feed）

### 已有但尚未产品化

- `watchlists` / `watchlist_events` 表结构与 seed/demo 场景
- `pgvector` 扩展基础设施
- `apps/web` 轻量控制台

### 尚未实现

- embedding pipeline
- topic clusters / topic memberships / taxonomy 节点持久化
- LLM topic naming
- 语义化 topic/insight APIs
- watchlist CRUD、digest、webhook
- analyst console 产品化
- direct GitHub API / GH Archive ingestion

### 当前系统更像什么

当前系统更接近：

```text
轻量版 Snowflake + 开发者信号采集与 question-pressure 管道
```

而不是：

```text
成熟的 Dev Intelligence / Insight 产品
```

## 本版核心决策

### 1. 下一阶段先做 Topic Layer，不先做 watchlist / digest

下一阶段的第一优先级：

1. 统一数据模型（HN / DEV / GitHub proxy）
2. embedding 生成
3. topic clustering
4. topic 自动命名（LLM）
5. topic 表落库
6. 由动态 topic 反推一级、二级、三级主题树

延后：

- watchlist CRUD
- digest / webhook
- analyst console 产品化

### 2. “GitHub” 继续使用 OSSInsight-backed proxy

当前与下一阶段都不直接接入：

- GitHub REST API
- GitHub GraphQL API
- GH Archive
- BigQuery GitHub Archive

v5 中凡是提到 `GitHub`，都指：

```text
OSSInsight-backed GitHub adoption proxy
```

也就是把开源增长、issue creator、PR creator、collection growth 等结构化指标作为 GitHub 信号代理层。

### 3. 继续坚持 rule-first，但允许 embedding-assisted

- 核心业务评分、confidence、merge guardrails 仍保持确定性与可测试。
- embedding 用于召回、聚类候选、相似主题合并辅助，而不是接管最终决策。
- LLM 只负责 topic naming、summary、keyword suggestion，不直接生成最终评分。

### 4. 分层词库来自动态聚类，不来自先验硬编码

v5 的标准化动态主题词库不是一份先写好的 taxonomy，而是：

```text
动态 topic clusters
  -> 候选 label
  -> 归并与去重
  -> 一级 / 二级 / 三级 taxonomy
```

这样可以避免维护一份很快过时的死 taxonomy。

## 数据层重新定义

### 当前已有层

```text
Raw Data Layer
  -> raw_snapshots / source_runs
Normalized Layer
  -> items / item_sources / item_topics / item_entities
Question Layer
  -> question_clusters / signals / signal_evidence
```

### 下一阶段新增层

```text
Feature Layer
  -> canonical content model
  -> source-specific features
  -> embeddings
Topic Layer
  -> topic clusters
  -> topic labels
  -> hierarchical taxonomy
Insight Layer（后续阶段）
  -> emerging topics
  -> cross-source resonance
  -> adoption evidence by topic
```

## Phase 2：Dynamic Topic Layer / Feature Layer MVP

### 目标

把当前“按 question 聚类 + pressure 打分”的系统，升级为“可持续沉淀主题资产”的系统，为后续 Insight API、watchlist 与商业化交付提供上层语义底座。

### 本阶段只做什么

- 建立 HN / DEV / OSSInsight proxy 的统一内容模型
- 为统一内容生成 embeddings
- 基于 embedding + rule-first guardrails 产出动态 topic clusters
- 用 LLM 为 topic cluster 生成 label / keywords / 简要说明
- 将 topic cluster、topic label、taxonomy 映射关系落库
- 输出一级、二级、三级主题结构
- 暴露最小只读 topic APIs，供 API / web / 后续 insight 层消费

### 本阶段明确不做什么

- watchlist CRUD 产品化
- digest / webhook
- 完整 analyst console
- direct GitHub ingestion
- account / auth / billing / quota

### 统一模型

本阶段把内容对象统一为文档级抽象，而不是直接沿用 source-specific payload：

```text
unified content record
  - canonical_id
  - source
  - source_item_id
  - title
  - summary
  - body_excerpt(optional)
  - url
  - author(optional)
  - published_at
  - tags
  - source_features
```

其中 `source_features` 用来承载不同来源的特征，例如：

- HN：points、comments、ask/show 标记
- DEV：tag density、reading time、tutorial intent
- OSSInsight proxy：stars growth、issue creator growth、PR creator growth、collection membership

### Embedding 生成

建议输入：

- `title`
- `summary`
- `tags`
- 选定的 source features（文本化）

建议原则：

- 只为经过基础清洗的 canonical content 生成 embedding
- 保留可重算能力，不把 embedding 视为唯一事实源
- 使用 `pgvector` 作为存储层，但 clustering 仍需 rule-first guardrails

### Topic Clustering

本阶段要把“question clusters”与“topic clusters”区分开：

- question cluster：问题型信号压缩
- topic cluster：更宽泛的主题抽象，允许非问句内容参与

Topic clustering 输入：

- unified content record
- embeddings
- tags / entities / repos / source overlap
- 时间窗口与新鲜度特征

Topic clustering 输出：

- `topic_cluster_id`
- representative items
- source mix
- related repos / entities
- trend signals
- candidate label
- confidence / merge flags

### Topic 自动命名（LLM）

LLM 仅负责：

- 为 cluster 生成候选 label
- 提炼 3-10 个关键词
- 生成 1-2 句摘要
- 生成一级 / 二级 / 三级候选分类建议

必须保留的 guardrails：

- cluster 代表样本与关键词必须可追溯
- LLM 输出不能直接覆盖 deterministic metadata
- taxonomy 最终归并规则仍需 deterministic / reviewable

### Topic Persistence

本阶段文档层面至少要明确这些对象：

- `embedding_record`
- `topic_cluster`
- `topic_cluster_item`
- `topic_label_candidate`
- `topic_node`（L1 / L2 / L3）
- `topic_membership`
- `topic_lineage`

与现有对象的关系：

- `runtime_topic_seeds`：继续承担“发现候选 topic”的作用
- `topics`：从当前 seed catalog 逐步演进为 curated / canonical topic registry
- `topic clusters`：承担“从动态数据中沉淀标准化主题资产”的职责

### 最小只读接口目标

本阶段建议新增但不要求一次性全部做完：

- `GET /topics`
- `GET /topics/:topicId`
- `GET /topics/:topicId/evidence`
- `GET /insights/topic-emerging`

这些接口是下一阶段规划，不代表当前仓库已实现。

### 验收标准

- HN / DEV / OSSInsight proxy 三类内容可以进入同一统一模型
- 至少能稳定生成一批动态 topic clusters，而不只是 question clusters
- 每个 topic cluster 都有：
  - label
  - keywords
  - source mix
  - representative evidence
  - related repos / entities
- 可以从动态 clusters 归并出一级 / 二级 / 三级主题节点
- 新 topic layer 不破坏现有 question pressure API 与 read console
- 允许抽样产出至少 3 份 topic report：
  - AI agents
  - MCP / tool calling
  - Vector database adoption

## Phase 3：Insight API / 决策接口

### 目标

把 Topic Layer 继续向上提升为“对外可消费的业务语义层”，逐步摆脱单纯 feed / raw data 视角。

### 任务

- 产出 topic-emerging / cross-source resonance / adoption evidence by topic
- 引入更强的 feature engineering
- 把 topic、question、entity、repo 连接成更强的 read model
- 在 API 层提供更靠近客户动作的 read endpoints

### 代表性接口方向

- `GET /insights/topic-emerging`
- `GET /insights/topic-cross-source`
- `GET /topics/:topicId/adoption-evidence`
- `GET /entities/:entityId/insight-summary`

## Phase 4：订阅分发与轻量商业化验证

### 目标

在 Topic Layer 与 Insight API 有基础后，再引入订阅分发能力，验证客户是否愿意把结果接入真实工作流。

### 任务

- watchlist CRUD
- digest grouping
- webhook / Slack / 飞书 等交付
- 用户试用与 workflow 验证

### 验收方向

- 用户不是“看看 feed”，而是真的接收并使用 digest
- 用户能把结果转为 docs / content / roadmap / competitor watch 动作
- 至少有明确试用或付费讨论信号

## Phase 5：增强商业化与平台化

### 目标

在 Topic Layer、Insight API、订阅分发都验证有效后，再推进更重的产品化能力。

### 任务

- API key / quota / usage
- export / scheduled export
- team accounts
- 更强的 console
- 评估 direct GitHub ingestion 是否有必要进入主链路

## Go / No-Go 指标

### 继续推进 Topic Layer 的信号

- Topic clusters 比 question clusters 更能稳定压缩信息噪音
- 目标用户开始围绕 topic / entity / repo 提需求，而不是只要 raw feed
- 用户愿意阅读 topic report，并认为其能指导产品 / 内容 / DevRel 动作
- Topic Layer 对后续 insight API 有明显支撑，而不是新增一层无用抽象

### 应暂停或转向的信号

- embedding + clustering 只得到大量不可解释的 topic
- LLM naming 无法稳定收敛为可信主题标签
- Topic taxonomy 无法形成稳定的 L1/L2/L3 结构
- 用户依旧只把产品当成新闻聚合 / feed 浏览器

## 文档对齐要求

从本版开始，所有顶层与子包文档都必须统一采用三层叙事：

1. 当前已实现的真实能力
2. 下一阶段（Phase 2）计划中的目标
3. 更后续阶段（Phase 3+）的延后事项

不要再把未来目标直接写成当前能力，也不要继续把 `apps/web` 描述为纯占位。

## 配套执行拆解

- 面向 Agent 的阶段性开发拆解见： [devtrend-cloud-phase2-execution-stages-2026-05-05.md](./devtrend-cloud-phase2-execution-stages-2026-05-05.md)
- 后续请按 `S1 -> S7` 逐阶段生成 spec，不要一次性尝试实现整个 `Phase 2+`。

## 最终建议

当前项目最值得做的不是继续包装 feed、watchlist、digest，而是先补齐一层真正有复用价值的主题语义资产：

```text
动态主题发现 -> 标准化主题沉淀 -> 层级 taxonomy -> insight API
```

只有这层建立起来，后续的 watchlist、digest、webhook、console 与商业化才会建立在真正的“产品语义”上，而不是继续建立在采集系统之上。
