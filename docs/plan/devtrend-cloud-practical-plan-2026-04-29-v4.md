# DevTrend Cloud：OSSInsight 优先的落地实施方案 v4

收敛时间：2026-04-29  
版本定位：基于 v3 复盘、OpenCLI 现场能力核验、OSSInsight 替代 GitHub 数据源后的工程落地版

## 一句话结论

DevTrend Cloud 第一阶段不做“全网开发者情报平台”，也不自建 GitHub firehose，而是先做：

> Developer Demand Watchlist：用 Stack Overflow、Hacker News、OSSInsight、DEV、Product Hunt 等公开开发者信号，帮 DevTool / SDK / AI Infra / DevRel 团队把分散技术信息压缩成可行动、可追溯、可订阅的问题压力与开源采用情报。

第一阶段只验证一个付费闭环：

```text
用户设置 topic/entity/watchlist
  -> 系统采集 public + browserless 数据
  -> 生成 question pressure / adoption evidence
  -> 输出 evidence drilldown
  -> 用户把结果转成 docs、content、roadmap、competitor watch 动作
```

当前仓库实现边界说明：

- 当前 repo 只交付 `Phase 0 + Phase 1`。
- `watchlists / digest / webhook` 在本文件中保留为后续阶段目标，不代表当前仓库已经交付这些对外能力。
- watchlist 在当前阶段只作为 seed / demo 场景存在，不开放写 API。

## 本版核心决策

### 1. 暂不直接接入 GitHub

前期不接：

- GitHub REST API
- GitHub GraphQL API
- GH Archive
- BigQuery GitHub Archive
- 自建 GitHub event warehouse

原因：

- GitHub 全量事件数据规模过大，过早接入会把 MVP 推向数据工程重资产。
- 第一阶段最重要的是验证客户是否愿意为“开发者需求压缩与证据链”付费，而不是验证能否复刻 OSSInsight。
- OpenCLI 本机当前没有 `github/*` 或 `gharchive/*` adapter，强行接入会偏离“快速跑通”目标。

### 2. 用 OSSInsight 作为 GitHub 信号代理层

本机已封装的 `opencli ossinsight` 能覆盖开源采用相关核心信号，而且全部是：

```text
Strategy: public
Browser: no
Domain: ossinsight.io
```

因此第一阶段把 OSSInsight 定义为：

> GitHub adoption proxy：不是完整 GitHub 数据源，而是开源项目增长、collection 增长、star/issue/PR creator 趋势的结构化代理层。

### 3. Codex / Coding Agent 参与开发，但不进入生产主链路

Codex 适合做：

- adapter smoke test
- 数据源健康巡检
- schema / API / worker 代码开发
- signal quality review
- topic/entity 合并建议
- demo watchlist 与样板报告生成
- adapter 失效时的诊断和修复建议

Codex 不适合承担：

- 定时核心采集的唯一执行者
- 标准化入库主链路
- 生产 API SLA
- 权限、计费、配额、安全策略
- 无人审核的最终信号判定

生产系统必须是 deterministic pipeline，Agent 是开发、巡检、质检和运营增强层。

## 真实需求重新定义

用户口头痛点是：

- “需要自己到处订阅科技/技术方面的 RSS，并自己整合太麻烦”
- “想避免信息过载/信息茧房”

但 B 端真实付费点不是“帮我读 RSS”，而是：

- 我需要知道开发者最近反复卡在哪里。
- 我需要知道这些问题是否正在增长。
- 我需要知道哪些新工具不是短期噪音，而是有真实开源采用迹象。
- 我需要每个结论都有 evidence，能放进 docs、DevRel、PM、content、sales、BI 或 agent 工作流。

因此第一阶段产品不要叫“RSS 聚合”或“技术新闻摘要”，而要表达为：

```text
把分散开发者信号压缩成可行动的需求情报。
```

## 第一阶段只做什么

第一阶段主产品：

```text
Question Pressure Feed + Evidence Drilldown
```

核心交付：

- `GET /signals/question-pressure`
- `GET /question-clusters/{id}`
- `GET /question-clusters/{id}/evidence`
- `POST /watchlists` （下一阶段）
- `GET /watchlists/{id}/digest` （下一阶段）
- `POST /webhooks/test` （下一阶段）

第一阶段只回答 4 个问题：

1. 哪些开发者问题正在重复出现？
2. 哪些问题正在增长或长期无人解决？
3. 这些问题影响哪些 topic/entity/repo？
4. 用户下一步应该修 docs、写内容、看竞品，还是进入产品路线讨论？

暂不做：

- 通用 RSS 阅读器
- 全文内容分发站
- 通用 trend dashboard
- 完整 launch radar
- 完整 analyst console
- OPML import 的正式产品化
- GitHub firehose / GH Archive 自建仓库
- Twitter / Reddit / Discord / Slack 主链路

## OSSInsight 指令能力映射

通过 `opencli ossinsight -h`，当前可用指令如下。

### 发现层

| 指令 | 用途 | 第一阶段用途 |
|---|---|---|
| `opencli ossinsight trending` | 获取 OSSInsight 热门仓库 | 开源热度入口，补充 topic/entity discovery |
| `opencli ossinsight collections` | 列出所有 collections | 建立开源领域 taxonomy |
| `opencli ossinsight hot-collections` | 列出热门 collections | 发现近期高活跃技术领域 |

### Collection 增长层

| 指令 | 用途 | 第一阶段用途 |
|---|---|---|
| `collection-repos <collectionId>` | 列出 collection 仓库 | 把 topic 映射到 repo 集合 |
| `collection-stars <collectionId>` | collection 内 star 增长排行 | 判断开源关注度增长 |
| `collection-issues <collectionId>` | collection 内 issue 增长排行 | 判断问题压力或采用摩擦 |
| `collection-prs <collectionId>` | collection 内 PR 增长排行 | 判断贡献活跃度 |

### Repo 趋势层

| 指令 | 用途 | 第一阶段用途 |
|---|---|---|
| `stargazer-history <repo>` | stargazer 趋势 | adoption_score 的主输入 |
| `issue-creator-history <repo>` | issue 创建者趋势 | 问题压力和用户采用摩擦输入 |
| `pr-creator-history <repo>` | PR 创建者趋势 | contributor activity 输入 |

### Repo 人群与组织层

| 指令 | 用途 | 第一阶段用途 |
|---|---|---|
| `stargazer-countries <repo>` | stargazer 国家分布 | enrich，不进 MVP 核心评分 |
| `stargazer-orgs <repo>` | stargazer 组织分布 | B 端 adoption evidence 增强 |
| `issue-creator-countries <repo>` | issue 创建者国家分布 | enrich |
| `issue-creator-orgs <repo>` | issue 创建者组织分布 | enrich |
| `pr-creator-countries <repo>` | PR 创建者国家分布 | enrich |
| `pr-creator-orgs <repo>` | PR 创建者组织分布 | enrich |
| `issue-creators <repo>` | issue 创建者排行 | 判断是否集中在少数用户 |
| `pr-creators <repo>` | PR 创建者排行 | 判断贡献是否健康 |

## OSSInsight 替代 GitHub 的边界

第一阶段可以承诺：

- repo / collection 级增长趋势
- star velocity
- issue creator growth
- PR creator growth
- collection 内 repo 排名变化
- repo 采用人群与组织分布的增强证据
- 与 Stack Overflow、HN、DEV、Product Hunt 的跨源共振

第一阶段不能承诺：

- GitHub issue 正文语义分析
- GitHub discussion 语义分析
- commit / release 全量活动分析
- fork velocity 的完整历史
- GitHub 全站任意 repo 即席深度分析
- 与 OSSInsight 不支持字段相关的实时指标

产品表达上必须写清楚：

```text
Open-source adoption signals powered by OSSInsight-backed public metrics.
```

不要写：

```text
Full GitHub intelligence.
```

## 第一阶段数据源

### P0 主链路

只使用 public + browserless，默认 10-30 分钟缓存，失败回退 last success。

| 数据源 | OpenCLI 指令 | 角色 |
|---|---|---|
| Stack Overflow | `hot` / `unanswered` / `bounties` / `search` | question pressure 主源 |
| Hacker News | `ask` / `show` / `top` / `new` / `search` | 讨论、问题、launch 共振 |
| OSSInsight | `trending` / `collections` / `hot-collections` / `collection-*` / repo history | 开源采用代理层 |
| DEV | `top` / `tag` | 教程、实践扩散、内容供给 |
| Product Hunt | `posts` / `today` | 新产品发布入口 |
| LessWrong | `frontpage` / `new` / `curated` | AI/agent 高信号观点源 |
| Lobsters | `hot` / `active` / `newest` | 高信噪比工程校准 |
| 36kr | `news` | 中文商业背景 |

### P1 延后增强

- `producthunt/browse`：依赖 `intercept + browser`，只做按需增强。
- `36kr/search` / `36kr/article`：可做专题增强，不进 SLA。
- `v2ex`：中文开发者源有价值，但第一阶段先不增加中英文 topic canonicalization 复杂度。
- Reddit / Twitter / Discord / Slack：暂不进入主链路，避免 cookie、反爬、登录态和合规成本过早膨胀。

## 数据模型收敛

第一阶段只建最小可用模型。

### 必做表

- `source_runs`
- `raw_snapshots`
- `items`
- `item_sources`
- `topics`
- `entities`
- `item_topics`
- `item_entities`
- `question_clusters`
- `question_cluster_items`
- `signals`
- `signal_evidence`
- `watchlists`
- `watchlist_events`
- `source_health`

### 暂缓表

- `comments`
- `authors`
- `topic_aliases` 的复杂审核流程
- `entity_aliases` 的复杂审核流程
- `launch_entities`
- `exports`
- `scheduled_exports`
- `team_accounts`
- `billing_usage`

## 信号计算收敛

### 1. question_pressure

第一阶段计算：

```text
question_pressure =
  unresolved_volume
+ bounty_or_high_score_boost
+ repeated_question_similarity
+ recent_growth
+ cross_source_mentions
+ affected_entity_weight
+ source_health_weight
```

输入：

- Stack Overflow unanswered / bounties / search
- HN Ask
- HN / DEV / LessWrong 中的疑问型标题
- OSSInsight issue creator growth
- 相关 repo 的 collection issue growth

输出字段：

- `cluster_id`
- `canonical_question`
- `pressure_score`
- `unresolved_volume`
- `growth_label`
- `affected_topics`
- `affected_entities`
- `related_repos`
- `source_distribution`
- `evidence_count`
- `recommended_action`
- `confidence_score`
- `freshness_minutes`
- `fallback_used`

### 2. adoption_evidence_score

第一阶段不做完整 `Launch Radar`，只做 adoption evidence，作为 question cluster 和 topic/entity 的辅助证据。

```text
adoption_evidence_score =
  ossinsight_star_growth
+ ossinsight_issue_creator_growth
+ ossinsight_pr_creator_growth
+ hn_show_or_discussion_presence
+ devto_tutorial_presence
+ producthunt_launch_presence
+ cross_source_resonance
```

输出字段：

- `entity_id`
- `entity_name`
- `repo_name`
- `adoption_score`
- `star_growth`
- `issue_creator_growth`
- `pr_creator_growth`
- `cross_source_mentions`
- `evidence_items`
- `confidence_score`

### 3. confidence_score

第一阶段置信度只使用可解释因素：

- 来源数量
- evidence 数量
- 是否跨源出现
- OpenCLI source health
- 是否使用 fallback cache
- topic/entity 匹配置信度
- 是否只有单一榜单信号

不要让 LLM 直接生成最终置信度。

## 抗信息过载与信息茧房设计

“避免信息过载/信息茧房”不能停留在口号，第一阶段用这些机制落地：

- `duplicate_compression_ratio`：原始 item 压缩成 cluster 的比例。
- `source_diversity_score`：同一信号是否来自多个社区。
- `source_mix`：显示 Stack Overflow / HN / OSSInsight / DEV / PH 的占比。
- `opposing_or_low_confidence_note`：当只有单源、低样本、或榜单噪音时明确标记。
- `novelty_label`：区分 recurring pain、new spike、long-tail unresolved。
- `mute_rules`：watchlist 支持排除 topic/entity/source。
- `max_digest_items`：digest 默认只给 Top 5-10，不做无限 feed。

## API 第一阶段设计

### Feed 仅作调试入口

```http
GET /feed?watchlist_id=xxx
GET /feed?topic=ai-agents
```

用途：

- 调试采集结果
- demo evidence drilldown
- 低门槛开发者入口

不围绕 `/feed` 做品牌。

### Question Pressure

```http
GET /signals/question-pressure
GET /signals/question-pressure?topic=ai-agents
GET /signals/question-pressure?entity=langchain
GET /question-clusters/{cluster_id}
GET /question-clusters/{cluster_id}/evidence
```

### Adoption Evidence

```http
GET /entities/{entity_id}/adoption-evidence
GET /repos/{owner}/{repo}/adoption-evidence
GET /topics/{slug}/adoption-evidence
```

### Watchlist / Digest

```http
POST /watchlists
GET /watchlists
GET /watchlists/{id}
GET /watchlists/{id}/events
GET /watchlists/{id}/digest
POST /watchlists/{id}/webhooks
POST /webhooks/test
```

## 工程架构

第一阶段架构：

```text
OpenCLI public adapters
  -> source schedulers
  -> raw_snapshots
  -> normalizers
  -> topic/entity matcher
  -> question clusterer
  -> signal calculators
  -> cached API
  -> digest/webhook

Codex / Coding Agent
  -> code implementation
  -> adapter smoke tests
  -> source health review
  -> signal QA
  -> topic/entity curation suggestions
  -> demo report generation
```

推荐技术：

- API：FastAPI / Node.js 均可，优先沿现有团队熟悉栈。
- DB：Postgres。
- Vector：pgvector。
- Cache：Redis。
- Raw archive：S3 / R2 / 本地 MinIO 起步。
- Worker：BullMQ / Celery / Temporal 三选一，第一阶段用最熟悉的即可。
- Scheduling：每源独立 cron/worker，不共享失败域。

## Codex / Agent 开发分工

### Agent 适合承担的第一阶段任务

| 任务 | 说明 | 产物 |
|---|---|---|
| OpenCLI contract audit | 定期跑 `opencli <site> <command> -h` 与 smoke sample | command registry 快照、字段变化报告 |
| Adapter smoke test | 每个 P0 指令跑 `--limit 3 -f json` | source health 初始基线 |
| Schema 草案生成 | 根据实际 JSON 输出生成最小 schema | migration / model 文件 |
| Normalizer 实现 | 按 source 写 item normalizer | normalized item |
| Signal QA | 抽查 Top clusters 是否可解释 | QA report |
| Demo watchlist | 生成 3 个样板 watchlist | AI agents / MCP / vector db |
| Docs / API examples | 自动生成 API 示例 | README / sample response |

### Agent 不进入生产闭环的任务

| 任务 | 原因 |
|---|---|
| 定时采集执行者 | 需要稳定、可观测、可重试的 worker |
| 最终信号裁决 | 需要确定性规则和人工 QA |
| 计费与权限 | 高风险工程域 |
| 自动修改生产 adapter 并上线 | 需要 CI、review、回滚 |
| 无审核发送客户 digest | 避免错误信号直接触达客户 |

## 阶段排期

### Phase 0：3 天技术预检

目标：证明数据源可稳定进入 pipeline。

任务：

- 跑 `opencli list -f yaml` 建 registry 快照。
- 跑 P0 指令 help，记录 strategy、browser、columns。
- 每个 P0 指令执行 `--limit 3 -f json` smoke test。
- 建 `source_health` 字段设计。
- 确定 3 个 seed watchlists：
  - AI agent evals
  - MCP / tool calling
  - Vector database adoption
- 确定 20-50 个 topic/entity seed。

验收：

- P0 指令 80% 以上连续 3 次 smoke 成功。
- 每个失败源能记录 error、last_success、fallback_used。
- OSSInsight 至少跑通：
  - `trending`
  - `collections`
  - `hot-collections`
  - `collection-stars`
  - `collection-issues`
  - `stargazer-history`
  - `issue-creator-history`
  - `pr-creator-history`

### Phase 1：第 1-2 周，Question Pressure MVP

目标：跑通第一条可卖链路。

任务：

- 建 `raw_snapshots`、`source_runs`、`items`、`source_health`。
- 实现 P0 collectors：
  - Stack Overflow
  - Hacker News
  - OSSInsight
  - DEV
- 实现 item normalizer。
- 实现 topic/entity seed matcher。
- 实现 question extraction。
- 实现 question clustering。
- 实现 `question_pressure` 规则评分。
- 实现 evidence drilldown。
- 实现 API：
  - `/feed`
  - `/signals/question-pressure`
  - `/question-clusters/{id}`
  - `/question-clusters/{id}/evidence`

验收：

- 每天能生成至少 20 个 question clusters。
- 每个 cluster 至少有 3 条 evidence，低于 3 条必须标低置信度。
- 每个 API 响应包含：
  - `freshness_minutes`
  - `fallback_used`
  - `source_status`
  - `confidence_score`
  - `evidence_count`
- 能手动给 3 个样板客户场景产出 Markdown report。

### Phase 2：第 3 周，Watchlist / Digest

目标：让用户不用刷 feed，而是收到行动摘要。

任务：

- 实现 watchlist CRUD。
- 实现 watchlist rule：
  - topic
  - entity
  - repo
  - source mix
  - mute source
  - min confidence
- 实现 digest grouping：
  - `Fix docs`
  - `Write content`
  - `Watch competitor`
  - `Investigate feature gap`
- 实现 webhook digest。
- 增加 Product Hunt、LessWrong、Lobsters、36kr/news collectors。
- 把 OSSInsight adoption evidence 接入 digest。

验收：

- 每个样板 watchlist 每天输出 Top 5-10 条 digest。
- digest 每条都有 evidence link。
- digest 能说明为什么不是噪音：
  - source diversity
  - evidence count
  - OSSInsight adoption evidence
  - confidence score
- 至少 3 个外部潜在用户愿意看一周 digest。

### Phase 3：第 4 周，客户验证与轻量 Console

目标：验证是否值得继续投入，而不是堆功能。

任务：

- 做最小 analyst console：
  - Source Health page
  - Watchlist page
  - Question Cluster page
  - Evidence page
- 加人工 QA 标记：
  - useful
  - noisy
  - duplicate
  - wrong entity
  - wrong topic
- 输出 3 份样板报告：
  - AI agent evals
  - MCP / tool calling
  - Vector database adoption
- 访谈 5-10 个目标客户。

验收：

- 至少 5 个目标用户完整阅读 digest。
- 至少 3 个用户把某条信号转成实际动作：
  - docs issue
  - content brief
  - roadmap note
  - competitor watch
  - DevRel follow-up
- 至少 2 个用户愿意继续试用或讨论付费。

### Phase 4：第 5-8 周，增强与商业化

只有 Phase 1-3 验证通过后才进入。

任务：

- 增强 entity resolution。
- 增强 topic canonicalization。
- 增强 comment intelligence。
- 产品化 OPML import。
- 增加 CSV / NDJSON / Parquet export。
- 增加 Slack / 飞书 / Discord 集成。
- 增加 API key、quota、usage dashboard。
- 增加 Team account。
- 评估是否接入 GitHub API / GH Archive / BigQuery。

GitHub 是否进入 Phase 4 的判断标准：

- 客户明确要求 repo-level 深度分析，而 OSSInsight proxy 不够。
- 已有 3 个以上付费或强意向客户。
- 当前 watchlist digest 被稳定使用。
- 已证明 GitHub issue/discussion 正文会显著提高 signal 质量。

## Go / No-Go 指标

### 继续做的信号

- 目标客户认为 digest 可直接进入工作流。
- 用户能指出哪些信息以前需要手动刷多个源，现在被压缩掉了。
- 用户会要求增加 watchlist，而不是只说“这个挺有意思”。
- 用户愿意提供自己的 topic/entity/competitor 清单。
- 用户愿意为每周情报、API、webhook 或 export 付费。

### 应该暂停或转向的信号

- 用户只把它当技术新闻摘要看。
- 用户不点击 evidence。
- 用户不把结果转成行动。
- Question clusters 多数无法解释或重复。
- OSSInsight adoption evidence 与用户关心的实体不匹配。
- 采集维护成本高于信号价值。

## 第一阶段定价假设

第一阶段不要卖“API 调用量”，先卖工作流价值。

### Trial

- 3 个 watchlists
- 每日 digest
- Evidence drilldown
- 7 天试用

### Team Starter

- 10-20 个 watchlists
- Webhook / Slack / 飞书一种集成
- CSV export
- 每周 signal QA report

### Pro / API

- API access
- scheduled export
- custom topic/entity seeds
- higher freshness SLA
- source health visibility

## 风险与缓解

| 风险 | 表现 | 缓解 |
|---|---|---|
| 伪需求 | 用户觉得有趣但不用 | 以 digest 行动转化作为核心指标 |
| 信息过载 | 输出仍像 feed | 每个 watchlist 默认 Top 5-10 |
| 信息茧房 | 只推同类来源 | 强制展示 source diversity 与低置信标记 |
| OpenCLI 源不稳定 | 采集失败或部分返回 | source health + last success fallback |
| OSSInsight 覆盖不足 | 部分 repo/entity 查不到 | 标记 unsupported，不做假推断 |
| LLM 幻觉 | recommended_action 不可信 | action 必须绑定 evidence 和规则 |
| 范围膨胀 | 同时做 dashboard、OPML、launch radar | Phase 1-3 未过验收前不做 |

## 最终建议

这个赛道能做，但第一阶段要极度克制。

最好的 MVP 不是“开发者趋势平台”，而是：

```text
每天给 SDK / AI Infra / DevRel 团队 5-10 条可追溯的开发者问题压力与开源采用信号。
```

只要客户愿意把这些信号转成 docs、content、roadmap、competitor watch，就证明方向成立。  
在此之前，不自建 GitHub warehouse，不扩大到 Twitter/Reddit/Discord，不做完整 RSS 迁移，不做复杂 console。

第一阶段靠 OpenCLI public adapters + OSSInsight proxy + Postgres/Redis/pgvector 足够跑通。  
真正的护城河不是抓取源数量，而是：

- topic/entity/watchlist 的客户语义
- question cluster 的压缩质量
- evidence-backed action 的可信度
- source health 和 fallback 的稳定交付
- 长期积累的客户反馈与人工校准数据
