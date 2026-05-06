# 文档更新计划：Phase 2 Topic Layer 路线对齐（2026-05-05）

## Summary

- 目标：仅更新规划与说明文档，不改业务代码；基于 `docs/reports/review-2026-05-05.md` 与 `docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md`，生成一份新的开发计划文档，并把 `AGENTS.md` 与相关 docs 对齐到“已完成 Phase 0 + Phase 1，下一阶段进入 Topic Layer / Feature Layer”的新阶段叙事。
- 核心方向：不再把 `watchlist / digest / webhook` 作为紧接着的下一阶段主轴，而是把下一阶段收敛为“分层级标准化动态主题词库 + Topic Layer MVP”。
- 关键产出：
  - 在 `docs/plan/` 新增一份最新计划文档，作为新的事实源。
  - 同步更新根 `AGENTS.md` 与关键说明文档，使其准确表达当前实现现状、下一阶段目标、以及延后目标。
  - 明确“GitHub”在下一阶段仍采用 `OSSInsight-backed GitHub adoption proxy`，不引入直接 GitHub API / GH Archive。

## Current State Analysis

### 已确认已实现的能力

- Monorepo、`pnpm workspace`、`TypeScript + SWC`、Fastify、BullMQ、Postgres、Redis 已落地。
- `packages/sources` 已实现 Stack Overflow / Hacker News / DEV / OSSInsight 的 contract audit、collector、normalizer、runtime topic discovery。
- `packages/domain` 已实现 rule-first 的 topic/entity matching、question extraction、question clustering、question pressure scoring。
- `packages/db` 已有 `source_runs`、`raw_snapshots`、`items`、`item_sources`、`topics`、`entities`、`question_clusters`、`signals`、`source_health`、`watchlists`、`watchlist_events`、`runtime_topic_seed_runs`、`runtime_topic_seeds` 等表。
- `apps/api` 已提供只读接口：`/healthz`、`/readyz`、`/feed`、`/signals/question-pressure`、`/question-clusters/:id`、`/question-clusters/:id/evidence`。
- `apps/web` 不是“占位”，而是已经存在一个轻量只读控制台，可浏览 feed、question pressure、cluster detail、health。

### 已确认但尚未进入下一阶段的能力边界

- `watchlists`、`watchlist_events` 已有表结构与 seed/demo 含义，但没有写 API、digest、webhook 的完整产品闭环。
- `pgvector` 扩展在 migration 中已启用为基础设施准备，但当前 domain 主链路仍是 rule-first，不依赖 embedding。
- 现有系统更接近“轻量版 Snowflake + 数据采集 / question-pressure pipeline”，还不是商业化完成态的 “Dev Intelligence” 产品。

### review 报告对路线的直接影响

- API 不能继续只停留在“数据访问层”；后续要演进到“业务语义 / 决策接口”。
- Worker 不能只做 ETL；需要新增 Feature Layer / Topic Layer。
- 下一阶段不应优先做静态标准词库、watchlist、digest，而应优先做：
  - 统一数据模型（HN / DEV / GitHub proxy）
  - embedding 生成
  - topic clustering
  - LLM topic naming
  - topic 表落库

### 当前文档与仓库事实的主要偏差

- `AGENTS.md`、`architecture.md`、`docs/api.md`、`docs/development.md`、`README.md` 仍以“仅 Phase 0 + Phase 1”作为唯一叙事。
- `AGENTS.md` 与 `architecture.md` 仍把 `apps/web` 描述为“占位 / 不做 console”，但仓库已存在可运行的只读控制台。
- `docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md` 的 Phase 2 从 `watchlist / digest` 开始，不再符合 `review-2026-05-05.md` 给出的新优先级。

## Assumptions & Decisions

- 决策 1：新的计划文档不覆盖旧文档，而是在 `docs/plan/` 新增一份 dated `v5` 文档，旧 `v4` 作为历史依据保留。
- 决策 2：新计划文档必须同时写清“当前已交付事实”和“下一阶段计划”，避免把未来能力写成当前能力。
- 决策 3：下一阶段的 “GitHub” 统一表述为 `OSSInsight-backed GitHub adoption proxy`；在未获授权前，不规划直接 GitHub API / GH Archive 接入。
- 决策 4：分层级词库不从拍脑袋 taxonomy 开始，而是从动态 topic clustering 产出的主题簇反推一级 / 二级 / 三级主题树。
- 决策 5：LLM 只用于 `topic label / summary / naming suggestion`，不直接裁决最终 `confidence_score` 或核心业务评分。
- 决策 6：文档同步时要区分三类内容：
  - 当前真实已实现
  - 下一阶段目标（Phase 2）
  - 更后续阶段（Phase 3+）

## Proposed Changes

### 1. 新增最新开发计划事实源

#### 文件

- `docs/plan/devtrend-cloud-practical-plan-2026-05-05-v5.md`

#### 变更内容

- 新建一份 `v5` 计划，替代 `v4` 作为后续开发事实源。
- 文档结构建议：
  - 背景变化：review 结论与商业化评估摘要
  - 当前仓库真实完成度
  - 为什么 Phase 2 不再以 watchlist/digest 为先
  - 新的阶段定义与阶段目标
  - Phase 2 Topic Layer MVP 的数据模型、处理链、验收口径
  - Phase 3+ 的 Insight API / 决策接口 / 订阅分发 / 商业化路径
  - Go / No-Go 指标与风险

#### Phase 2 在新文档中的必含内容

- 主题：`Dynamic Topic Layer / Feature Layer MVP`
- 必做能力：
  - 统一内容模型：把 HN / DEV / OSSInsight proxy 统一映射到一套 `canonical content + source-specific features` 模型
  - embedding 生成：针对 `title + summary + tags + selected metadata` 生成向量
  - clustering：生成动态 topic clusters，而不是只做 question clusters
  - LLM naming：对 cluster 产出的候选主题进行自动命名与关键词补全
  - topic persistence：写入 topic 表与 topic membership / taxonomy 映射表
  - 层级化 taxonomy：一级、二级、三级主题节点来自动态聚类后的归并，而不是手工先验硬编码
- 明确暂不做：
  - watchlist CRUD 产品化
  - digest / webhook
  - 完整 analyst console
  - direct GitHub ingestion

#### Phase 3+ 在新文档中的建议重排

- Phase 3：Insight API / 决策接口
  - 例如 `topic emerging`、`cross-source resonance`、`adoption evidence by topic`
- Phase 4：订阅分发与轻量商业化闭环
  - watchlist、digest、webhook、外部试用验证
- Phase 5：增强商业化能力
  - API key、usage、exports、团队协作、更多 source / GitHub 深度化评估

### 2. 更新仓库入口文档

#### 文件

- `AGENTS.md`

#### 变更内容

- 把事实源从 `v4` 调整为新 `v5` 计划文档。
- 将“当前交付边界：仅 Phase 0 + Phase 1”调整为更准确的双层表达：
  - 当前代码实现：以 Phase 0 + Phase 1 为主，附带只读 console 与 runtime topic discovery
  - 当前文档规划目标：下一阶段进入 Phase 2 Topic Layer
- 删除或改写“不要跳到 Phase 2 行为”这类已过时限制，改为“未授权前不直接编码实现 Phase 2；规划上以 Topic Layer 为下一优先级”。
- 把 `apps/web` 从“仅占位”更新为“只读控制台已存在，但不是产品化 console”。
- 在全局工程偏好中新增一条下一阶段约束：
  - `rule-first + embedding-assisted`
  - LLM 仅用于 topic naming / summarization，不用于核心评分裁决

### 3. 更新顶层架构文档

#### 文件

- `architecture.md`

#### 变更内容

- 从“Phase 0 + Phase 1 架构地图”改为“当前实现 + 下一阶段架构演进地图”。
- 明确当前实际存在的轻量 web console。
- 把现有流水线描述扩展为：
  - Raw Data Layer
  - Normalized Layer
  - Feature Layer（下一阶段新增）
  - Topic Layer（下一阶段新增）
  - Insight Layer（后续阶段）
  - API / Delivery Layer
- 在图中补充未来但未实现的 Phase 2 模块，不伪装成当前能力：
  - canonical content model
  - embedding generation
  - topic clustering
  - topic labeler
  - hierarchical taxonomy

### 4. 更新开发文档

#### 文件

- `docs/development.md`

#### 变更内容

- 保留当前真实可运行的开发/启动/验证说明，不新增未实现命令。
- 增加“当前实现范围”与“下一阶段规划”两个明确分栏，避免把 roadmap 写成运行说明。
- 在基础设施章节补充解释：
  - `pgvector` 已在数据库层启用，但当前仅作为下一阶段 embedding 能力预备
  - 当前没有 embedding pipeline、LLM naming worker、topic taxonomy persistence job
- 如需提及下一阶段配置，仅作为“计划中的新增配置项”列出，不写成已存在的环境变量要求。

### 5. 更新 API 文档

#### 文件

- `docs/api.md`

#### 变更内容

- 保留当前已实现只读 API 的事实描述。
- 增加“规划中接口”章节，区分：
  - 当前可用接口
  - Phase 2 计划中的 topic/insight read APIs
  - 后续阶段才会考虑的 watchlist/digest/write APIs
- 将 review 报告中的“决策接口”方向收敛为 roadmap，而不是把 `/insights/*` 直接声明成已实现。

### 6. 更新子包 AGENTS 文档

#### 文件

- `apps/api/AGENTS.md`
- `apps/worker/AGENTS.md`
- `apps/web/AGENTS.md`
- `packages/domain/AGENTS.md`
- `packages/db/AGENTS.md`
- `packages/sources/AGENTS.md`

#### 变更内容

- `apps/api/AGENTS.md`
  - 当前职责仍以只读 API 为主
  - 下一阶段增加 topic/insight read model 与语义化 read endpoints 的规划说明
  - 暂不开放 write API
- `apps/worker/AGENTS.md`
  - 补入 Phase 2 的 worker 编排职责：embedding job、topic clustering job、topic naming job、topic persistence job
  - 明确 LLM 参与点仅限命名/摘要
- `apps/web/AGENTS.md`
  - 修正为“轻量只读控制台已存在”
  - 标注未来可能新增 topic 页面 / insight 页面，但仍非完整 analyst console
- `packages/domain/AGENTS.md`
  - 从“question pressure domain”扩展到“question layer + topic layer”
  - 明确下一阶段引入 embedding-assisted clustering，但继续保持 rule-first 守门
- `packages/db/AGENTS.md`
  - 增加下一阶段计划中的 topic-layer tables 说明，使用“planned”口径，不伪造现有 schema
- `packages/sources/AGENTS.md`
  - 明确“GitHub”下一阶段仍通过 OSSInsight proxy 进入统一模型，不新增直接 GitHub source adapter

### 7. 更新与事实冲突的补充文档

#### 文件

- `README.md`
- `apps/web/README.md`

#### 变更内容

- `README.md`
  - 同步新的整体定位：当前已完成 Question Pressure MVP 骨架，下一阶段进入 Topic Layer / Feature Layer
- `apps/web/README.md`
  - 去掉“仅 Phase 0 + Phase 1”的单一表述，改为“当前提供只读控制台，后续将扩展 topic / insight 浏览能力”

### 8. 明确新计划文档中的下一阶段数据设计口径

#### 文件

- `docs/plan/devtrend-cloud-practical-plan-2026-05-05-v5.md`

#### 变更内容

- 需要明确列出 Phase 2 的文档级数据对象，而不是直接写 SQL：
  - unified content record
  - source-specific features
  - embedding record
  - topic cluster
  - topic label candidate
  - taxonomy node（L1 / L2 / L3）
  - topic membership / lineage
- 需要明确 Topic Layer 与现有 `topics` / `runtime_topic_seeds` 的关系：
  - `runtime_topic_seeds` 继续承担“发现候选”
  - Topic Layer 新对象承担“聚类后的标准化主题资产”
  - 现有 seed catalog 未来转为 bootstrap / fallback / curated override

## Verification Steps

- 确认新计划文档引用的所有当前能力都能在现有仓库中找到对应实现或审计依据：
  - `apps/web` 只读控制台存在
  - `apps/api` 现有只读 routes 存在
  - `packages/domain` 现有 question pipeline 存在
  - `packages/db` 已启用 `pgvector` 扩展并存在相关主题/信号表
- 确认所有更新文档都将使用“当前已实现 / 下一阶段计划 / 更后续阶段”三层叙事，避免误导。
- 确认新计划与 `review-2026-05-05.md` 一致：
  - 先做 dynamic topic clustering，再做分层词库
  - LLM 只负责 topic naming，不接管核心评分
  - API 演进方向是 insight/decision-oriented，而非继续停留在 raw feed
- 确认 `AGENTS.md` 与 `architecture.md` 不再把 `apps/web` 描述为纯占位。
- 确认 `docs/api.md` 不会把未来 `/insights/*` 或 watchlist 写接口误标成当前已上线。
