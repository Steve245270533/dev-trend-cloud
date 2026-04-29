# DevTrend Cloud：可落地实践方案 v3

调研与收敛时间：2026-04-28  
版本定位：基于 v2 方案与竞品调研后的商业实施优化版

## 一句话结论

DevTrend Cloud 不应只定位为“开发者趋势信号层”，而应进一步收敛为：

> Developer Demand Intelligence API：用开发者社区、开源活动、新产品发布和问题簇，告诉 AI / DevTool / SDK / DevRel 团队“开发者下一步会需要什么、正在卡在哪里、哪些新工具正在形成威胁或机会”。

v3 的核心变化：

- `Question Pressure` 从三个产品之一，升级为第一主打产品
- `GitHub` 从缺失源，升级为 MVP Core 数据源
- `Launch Radar` 从“新项目热度”升级为“竞品与机会雷达”
- 增加 `Evidence Graph`，每个信号都能回溯到底层样本
- 增加从 `Feedly / Inoreader / OPML` 迁移的产品路径
- 商业包装从“接口套餐”改为“场景套餐”

## 竞品调研后的判断

目前市场上已经有大量相邻产品，但没有完全等价的“开发者需求情报 API 层”。

### 1. RSS / 信息监控型

代表产品：

- `Feedly Market Intelligence`
- `Inoreader`
- `Folo + RSSHub`
- `FreshRSS / Miniflux`

它们已经覆盖：

- 订阅源聚合
- 关键词监控
- Web alerts
- AI 摘要
- 邮件 newsletter
- 团队协作
- 部分 API / webhook / integration

DevTrend Cloud 不应和它们争“阅读体验”或“通用信息监控”，而应争：

- 开发者专用 schema
- question pressure
- launch adoption evidence
- developer demand signals
- API-first / warehouse-ready 输出

### 2. 通用趋势情报型

代表产品：

- `Exploding Topics`
- `Trendtracker`
- `TrendRadar`
- `Trend Hunter`

它们已经覆盖：

- 关键词趋势发现
- 趋势增长率
- 产品 / startup 趋势
- AI trend radar
- 趋势预测和评分

DevTrend Cloud 不应泛化成“另一个 trend dashboard”，而应避开大而全市场，专攻：

- developer tools
- AI infrastructure
- SDK / API adoption
- open-source and community signals
- unanswered questions and unmet demand

### 3. 开发者 / 社区信号型

代表产品：

- `Common Room`
- `OSSInsight`
- `ProductIntelHub`
- `Orbit / Threado` 这类社区 intelligence 产品

它们证明了几个事实：

- GitHub / Stack Overflow / DEV / Discord / Slack 等开发者源具有商业价值
- 开源增长、社区行为、问题讨论可以转化为 GTM / DevRel 信号
- Product Hunt + Hacker News + Indie Hackers 这类组合适合做 launch radar

但它们的主要不足是：

- Common Room 更偏 all-in-one GTM 平台，不是轻量 API 数据层
- OSSInsight 主要覆盖 GitHub，不负责跨社区 developer demand
- ProductIntelHub 更偏新产品发现，不足以覆盖 question pressure 和 developer pain
- 社区平台多数偏 UI / CRM 工作流，不适合直接作为 agent / BI / warehouse 的标准化数据底座

## v3 定位

### 做什么

- 做 Developer Demand Intelligence API
- 做开发者需求、痛点、开源增长、新工具发布的统一信号层
- 做可解释、可追溯、可缓存、可导出的 DaaS 产品
- 做 AI / DevTool / SDK / DevRel 团队的外部市场雷达

### 不做什么

- 不做通用 RSS 阅读器
- 不做泛市场趋势工具
- 不做所有网站的抓取代理
- 不做没有证据链的 AI 摘要产品
- 不做以人工 dashboard 为核心的分析咨询服务

### 新品牌心智

不再主打：

- trend feed
- developer news
- AI summary
- multi-source aggregator

主打：

- developer demand
- unresolved developer pain
- launch adoption evidence
- competitor and opportunity radar
- evidence-backed API signals

## 目标客户重新排序

### 第一优先级：SDK / API / DevTool 公司

购买理由：

- 发现开发者正在卡住的问题
- 判断哪些文档、教程、功能最该补
- 监控竞品和替代工具的社区扩散
- 把 question pressure 接入产品、文档、DevRel 工作流

典型岗位：

- Developer Relations
- Product Marketing
- Product Manager
- Docs Lead
- Founder / CTO

### 第二优先级：AI Infra / Agent Infra 团队

购买理由：

- 监控 agent framework、RAG、eval、tool calling、workflow 等问题增长
- 找到新的 unmet demand
- 跟踪开源项目和新产品的 adoption evidence

### 第三优先级：技术内容 / 教育 / 社区团队

购买理由：

- 自动发现高增长问题
- 生成选题候选
- 判断教程缺口
- 追踪框架和工具热度变化

### 第四优先级：投研 / scout / AI 工具导航站

购买理由：

- 发现早期产品和开源项目
- 判断 launch 是否有真实开发者采用迹象
- 获取 structured export，而不是手动刷榜

## 产品结构 v3

v3 仍保留三个核心 API，但主次关系需要调整。

### 产品 1：Question Pressure API

这是首版主打产品。

核心价值：

- 告诉客户“开发者正在反复遇到哪些未解决问题”
- 告诉客户“哪些问题正在变严重”
- 告诉客户“这些问题背后对应什么产品机会、文档缺口或竞品风险”

核心接口：

- `GET /signals/question-pressure`
- `GET /signals/question-pressure?topic=ai-agents`
- `GET /signals/question-pressure?framework=nextjs`
- `GET /signals/question-pressure?entity=openai`
- `GET /signals/question-pressure/{cluster_id}`
- `GET /signals/question-pressure/{cluster_id}/evidence`

关键字段：

- `cluster_id`
- `canonical_question`
- `question_growth_rate`
- `unresolved_volume`
- `answer_scarcity`
- `repeat_cluster_count`
- `affected_entities`
- `affected_topics`
- `source_distribution`
- `representative_questions`
- `recommended_actions`
- `evidence_items`
- `confidence_score`
- `freshness_minutes`
- `fallback_used`

首版推荐问题类型：

- 未解决报错
- 文档缺口
- 集成失败
- 迁移困难
- 性能瓶颈
- 安全 / 合规疑虑
- 生产环境不稳定
- API 行为不符合预期

示例响应：

```json
{
  "cluster_id": "qp_ai_agents_eval_20260428",
  "canonical_question": "How should teams evaluate AI agent reliability before production deployment?",
  "question_growth_rate": 2.7,
  "unresolved_volume": 43,
  "answer_scarcity": 0.78,
  "repeat_cluster_count": 18,
  "affected_topics": ["ai-agents", "evals", "tool-calling"],
  "affected_entities": ["langchain", "openai", "crew-ai"],
  "source_distribution": {
    "stackoverflow": 0.42,
    "hackernews_ask": 0.24,
    "github_issues": 0.21,
    "devto": 0.13
  },
  "recommended_actions": [
    "Create production readiness checklist",
    "Publish eval examples for tool-calling failures",
    "Track recurring error messages in docs"
  ],
  "confidence_score": 0.84,
  "freshness_minutes": 14
}
```

为什么它最适合作为主打：

- 比 topic trending 更接近付费客户的真实决策
- 比 launch radar 更难被 Product Hunt 类产品替代
- 对 SDK / API / DevTool 公司有直接 ROI
- 可以转化为文档、内容、产品路线和销售线索

### 产品 2：Launch Radar API

v3 中的 Launch Radar 不只是发现新工具，而是升级为“竞品与机会雷达”。

核心价值：

- 告诉客户“哪些新工具正在被开发者认真采用”
- 告诉客户“它为什么重要、可能影响谁”
- 告诉客户“这是噪音、短期 launch，还是真实 adoption signal”

核心接口：

- `GET /signals/launch-radar`
- `GET /signals/launch-radar?category=developer-tools`
- `GET /signals/launch-radar?topic=ai-agents`
- `GET /signals/launch-radar/{entity_id}`
- `GET /signals/launch-radar/{entity_id}/evidence`
- `GET /signals/launch-radar/{entity_id}/competitive-overlap`

关键字段：

- `entity_id`
- `entity_name`
- `category`
- `launch_momentum`
- `developer_adoption_score`
- `cross_community_mentions`
- `source_resonance_score`
- `earliest_seen_source`
- `latest_seen_at`
- `related_entities`
- `competitive_overlap`
- `why_it_matters`
- `who_should_care`
- `go_to_market_angle`
- `evidence_items`
- `confidence_score`

推荐 adoption evidence：

- Product Hunt votes / comments
- Hacker News Show points / comments
- GitHub stars / forks / issues / contributors
- Dev.to tutorials / mentions
- Stack Overflow questions
- 36kr/news 中文商业背景

Launch Radar 的产品重点：

- 不只输出“新产品列表”
- 必须输出 adoption evidence
- 必须说明和哪些已有产品 / 主题 / 客群相关
- 必须能被 watchlist 订阅

### 产品 3：Topic Intelligence API

Topic Intelligence 继续保留，但不作为第一购买理由。

核心价值：

- 告诉客户“哪些开发者主题正在升温”
- 告诉客户“这个主题是媒体热、社区热、开源热，还是问题热”

核心接口：

- `GET /topics/trending`
- `GET /topics/{slug}`
- `GET /topics/{slug}/timeseries`
- `GET /topics/{slug}/sources`
- `GET /topics/{slug}/entities`
- `GET /topics/{slug}/questions`
- `GET /topics/{slug}/launches`
- `GET /topics/{slug}/evidence`

关键字段：

- `velocity_1h`
- `velocity_24h`
- `velocity_7d`
- `cross_source_spread`
- `source_mix`
- `question_pressure_score`
- `launch_activity_score`
- `open_source_activity_score`
- `first_seen_at`
- `peak_seen_at`
- `freshness_minutes`
- `confidence_score`

v3 中的关键调整：

- 不只回答“什么主题升温”
- 必须拆分升温来源：问题增长、发布增长、开源增长、讨论增长
- 每个 topic 下面必须关联 question clusters 和 launch entities

### 保留但降级：Trend Feed API

`/feed` 仍保留，但定位为：

- 调试入口
- demo 入口
- 低价开发者套餐入口
- evidence drilldown 的列表层

不要围绕 `/feed` 建品牌心智，也不要用它和 RSS 产品正面竞争。

## 数据源策略 v3

### MVP Core 数据源

| 层级 | 数据源 | 角色 | 进入 Core 的理由 |
|---|---|---|---|
| Core | `github` / `gharchive` / `ossinsight` | 开源增长与真实 adoption | 没有 GitHub，开发者趋势产品不完整。 |
| Core | `stackoverflow` | 问题压力主源 | unanswered、bounties、hot、search 可直接支持 question pressure。 |
| Core | `hackernews` | 开发者新闻、Ask、Show | 结构稳定，适合 topic、question、launch 三条线。 |
| Core | `producthunt` | 新产品发布 | 支撑 launch radar。 |
| Core | `devto` | 工程实践与教程扩散 | 标签、作者、教程信号清晰。 |
| Core | `lesswrong` | AI 深度观点和长评论 | 对 AI / agent / alignment 主题有高信号密度。 |
| Core-lite | `36kr/news` | 中文商业背景 | 补足中文创业与商业语境。 |
| Support | `lobsters` | 高信噪比工程校准 | 体量小，但可做质量校准。 |

### GitHub 的首版落地方式

不要第一天自建完整 GitHub firehose。

优先级：

1. `OSSInsight Public API` 或同类 GitHub 趋势数据源
2. GitHub REST / GraphQL API
3. GH Archive / BigQuery
4. 自建 GitHub event warehouse

首版只需要覆盖：

- trending repos by topic / language
- repo star velocity
- fork velocity
- issue growth
- contributor growth
- README / topics / description entity extraction
- release activity

### 暂不进入 MVP 主承诺

- `v2ex`
- `reddit`
- `twitter/x`
- `discord`
- `slack`
- `36kr/hot`
- `36kr/search`
- `36kr/article`
- `producthunt/browse`
- `producthunt/hot`

这些源可以作为 enrich 或客户定制源，但不进入第一版 SLA。

## 统一数据模型

v3 的核心不是统一字段，而是统一可计算对象。

### 核心对象

- `source_snapshot`
- `item`
- `comment`
- `author`
- `topic`
- `entity`
- `question_cluster`
- `launch_entity`
- `signal`
- `evidence`
- `watchlist`
- `alert_event`

### Evidence Graph

每个 signal 必须能回溯到证据图。

关系示例：

```text
topic -> question_cluster -> evidence_items
topic -> launch_entity -> evidence_items
entity -> related_topics
entity -> competing_entities
entity -> source_snapshots
question_cluster -> affected_entities
launch_entity -> competitive_overlap
signal -> raw_snapshot
```

Evidence Graph 的意义：

- 让客户相信信号
- 让模型输出可审计
- 让销售 demo 有底层样本可展示
- 让 API 客户能把结果放进自己的 RAG / BI / agent

### 推荐表结构

- `raw_snapshots`
- `source_runs`
- `items`
- `comments`
- `authors`
- `topics`
- `topic_aliases`
- `entities`
- `entity_aliases`
- `item_topics`
- `item_entities`
- `question_clusters`
- `question_cluster_items`
- `launch_entities`
- `launch_entity_items`
- `signals`
- `signal_evidence`
- `watchlists`
- `watchlist_rules`
- `watchlist_events`
- `exports`
- `source_health`

## 信号计算层

首版仍坚持可解释规则优先，不要过早上复杂黑箱模型。

### 1. question_pressure

计算建议：

```text
question_pressure =
  unresolved_volume_weight
+ growth_rate_weight
+ answer_scarcity_weight
+ repeat_cluster_weight
+ cross_source_weight
+ entity_importance_weight
```

核心输入：

- Stack Overflow unanswered / bounties
- HN Ask
- GitHub issues
- Dev.to 教程评论或实践文章
- LessWrong 评论中的问题型讨论

### 2. launch_momentum

计算建议：

```text
launch_momentum =
  producthunt_weight
+ hn_show_weight
+ github_growth_weight
+ devto_mention_weight
+ cross_source_resonance_weight
+ freshness_boost
```

核心输入：

- Product Hunt votes / comments
- HN Show points / comments
- GitHub star / issue / contributor velocity
- Dev.to mentions
- 36kr/news mentions

### 3. topic_velocity

计算建议：

```text
topic_velocity =
  recent_mentions / historical_baseline
  adjusted by source_quality, source_diversity, and freshness
```

必须拆分：

- `discussion_velocity`
- `question_velocity`
- `launch_velocity`
- `open_source_velocity`

### 4. developer_adoption_score

这是 v3 新增指标。

计算建议：

```text
developer_adoption_score =
  github_growth
+ issue_activity
+ tutorial_mentions
+ question_mentions
+ community_discussion_quality
+ repeat_mentions_across_sources
```

用于判断：

- 一个 launch 是否只是榜单噪音
- 一个开源项目是否真的被开发者采用
- 一个工具是否进入开发者讨论与实践链路

### 5. confidence_score

每个 signal 都必须有置信度。

考虑因素：

- 样本数量
- 来源多样性
- 来源健康状态
- 去重质量
- 实体匹配质量
- topic canonicalization 质量
- 是否使用 fallback cache

## Topic Canonicalization

必须把这些表达对齐为一个主题：

- `ai agents`
- `agentic ai`
- `agent framework`
- `智能体`
- `AI 代理`

输出必须包含：

- `canonical_topic`
- `aliases`
- `language_variants`
- `parent_topic`
- `related_topics`
- `confidence_score`
- `merge_history`

首版实现：

1. 人工维护高价值 topic seed
2. 规则词典和 alias 表
3. embedding 聚类
4. 人工审核合并
5. 对外暴露 canonical slug

## Entity Resolution

v3 中 entity resolution 是 launch radar 的核心护城河。

实体类型：

- product
- company
- open_source_repo
- framework
- library
- protocol
- model
- author

合并依据：

- normalized URL
- GitHub repo URL
- product domain
- name similarity
- description embedding
- source co-mention
- manual merge

输出必须包含：

- `entity_id`
- `canonical_name`
- `aliases`
- `homepage_url`
- `github_url`
- `source_profiles`
- `related_topics`
- `competing_entities`
- `confidence_score`

## Comment Intelligence

评论层仍是对 RSS / trend dashboard 的重要差异点。

重点提取：

- 主要争议点
- 实操经验
- 失败案例
- 共识与分歧
- 高质量评论作者
- 隐含问题
- 替代方案提及
- 购买 / 采用 / 放弃理由

优先来源：

- Hacker News comments
- LessWrong comments
- Stack Overflow answers / comments
- GitHub issues / discussions

首版不要对所有评论做 LLM 摘要。建议：

- 先用规则和 engagement 选高价值评论
- 只对高价值 thread 做 LLM extraction
- 结果按 input hash 缓存
- 每条摘要保留 evidence item

## API 设计

### 通用响应元信息

所有接口必须返回：

- `cache_fetched_at`
- `freshness_minutes`
- `fallback_used`
- `source_status`
- `confidence_score`
- `evidence_count`
- `response_generated_at`

### Evidence API

新增核心接口：

- `GET /evidence/{evidence_id}`
- `GET /signals/{signal_id}/evidence`
- `GET /entities/{entity_id}/evidence`
- `GET /topics/{slug}/evidence`
- `GET /question-clusters/{cluster_id}/evidence`

Evidence item 字段：

- `evidence_id`
- `source`
- `source_url`
- `source_type`
- `title`
- `snippet`
- `author`
- `published_at`
- `observed_at`
- `engagement`
- `matched_topic`
- `matched_entity`
- `raw_snapshot_id`

### Export API

首版支持：

- `json`
- `csv`
- `markdown`

Pro / Enterprise 支持：

- `parquet`
- `ndjson`
- `chunked_passages`
- scheduled export
- warehouse sync

## 迁移策略

要吸引 Feedly / Inoreader / RSS 用户迁移，必须降低迁移成本。

### 必做迁移能力

- OPML import
- RSS feed import
- keyword watchlist import
- source mapping report
- topic mapping report
- duplicate source cleanup

### 推荐迁移体验

用户上传 OPML 后，系统输出：

- 当前订阅源覆盖哪些 topic
- 哪些 topic 有 question pressure
- 哪些 source 可以被 DevTrend signal 替代
- 推荐保留的 sources
- 推荐删除的 noisy feeds
- 推荐创建的 watchlists

迁移报告示例：

```text
Your 126 feeds can be compressed into 18 developer demand watchlists.
Top suggested watchlists:
- AI agent evals
- TypeScript framework churn
- Vector database adoption
- Open-source observability tools
```

这个能力比单纯提供 API 更容易促成付费迁移。

## 工作流产品

API 是底座，但客户愿意持续付费通常来自工作流。

### Watchlist

支持订阅：

- topic
- entity
- framework
- repo
- competitor
- question cluster
- category
- source mix

### Alert

触发规则：

- question pressure 超过阈值
- launch momentum 突增
- competitor 被多个来源提及
- GitHub star velocity 异常
- Stack Overflow unanswered 问题增长
- topic 进入 cross-source spread

### Digest

输出形态：

- email
- Slack
- Discord
- 飞书
- webhook
- markdown report
- CSV / parquet export

Digest 不应只是摘要，而要按行动分组：

- `Fix docs`
- `Write content`
- `Watch competitor`
- `Investigate feature gap`
- `Contact community`
- `Update roadmap`

## Analyst Console

虽然 DevTrend Cloud 应该 API-first，但 v3 建议补一个轻量 analyst console。

目的：

- 销售 demo
- evidence drilldown
- source health 展示
- watchlist 配置
- topic/entity 人工校准

首版页面：

- Topic page
- Entity page
- Question Cluster page
- Launch Radar page
- Evidence page
- Source Health page
- Watchlist page

注意：

- Console 是 API 的可视化，不是主产品
- 不要做 RSS 阅读器式体验
- 页面重点展示 signal、evidence、actions

## 工程落地方案

### 采集层

继续使用：

```bash
opencli <site> <command> -f json
```

原则：

- 每个源独立调度
- 每次采集写入 raw snapshot
- 失败时不覆盖 last success
- 所有源记录 source health
- 主链路优先 public + browserless

建议 TTL：

- `hackernews top/new/ask/show`：10 分钟
- `stackoverflow hot/unanswered/bounties/search`：15-30 分钟
- `github / ossinsight`：15-30 分钟
- `producthunt posts/today`：15 分钟
- `devto top/tag`：20-30 分钟
- `lesswrong frontpage/new/curated/shortform/comments`：15-30 分钟
- `36kr/news`：20 分钟
- `author / repo / tag metadata`：6-24 小时

### 存储层

推荐：

- `Redis`：热缓存
- `Postgres`：标准化对象、signals、watchlists
- `pgvector`：embedding 和相似度
- `S3 / R2`：raw snapshots、历史归档、导出文件

### Worker 层

任务类型：

- `collect_source`
- `normalize_items`
- `extract_topics`
- `extract_entities`
- `cluster_questions`
- `resolve_entities`
- `calculate_signals`
- `generate_evidence`
- `evaluate_watchlists`
- `send_digest`
- `build_exports`

### Agent / Skills 层

Agent 不作为生产主链路，但适合做维护和增强。

适合交给 Agent 的任务：

- OpenCLI adapter smoke test
- adapter 失效诊断和修复建议
- source health 日报
- topic/entity 合并建议
- signal quality review
- sales demo watchlist 生成
- API docs 和 sample report 生成

不建议交给 Agent 的任务：

- 定时核心采集
- 标准化入库
- 主指标计算
- SLA 响应
- 权限和计费

最终模式：

```text
OpenCLI adapters
  -> deterministic collectors
  -> raw snapshots
  -> normalized database
  -> signal calculators
  -> cached APIs
  -> watchlist / webhook / export

Agents / Skills
  -> adapter autofix
  -> source health review
  -> signal QA
  -> topic/entity curation
  -> docs/demo generation
```

## 4 周 MVP 路径 v3

### 第 1 周：数据底座与 GitHub 补齐

任务：

- 跑通 `hackernews`
- 跑通 `stackoverflow`
- 跑通 `github / ossinsight`
- 建立 `raw -> normalized -> cache`
- 设计 `item / topic / entity / evidence` 最小 schema
- 打通 `GET /feed`
- 打通 `GET /topics/trending`

验收：

- 每个源至少 3 个稳定命令或 API 入库
- API 响应包含 freshness 元信息
- 有 source health 和 last success
- 每个 item 可追溯 raw snapshot

### 第 2 周：Question Pressure 主链路

任务：

- 做 question extraction
- 做 question clustering
- 做 `question_pressure`
- 做 `GET /signals/question-pressure`
- 做 `GET /signals/question-pressure/{cluster_id}`
- 做 evidence drilldown

验收：

- 能输出至少 20 个问题簇
- 每个问题簇包含 representative questions
- 每个问题簇有 affected topic / entity
- 每个问题簇可回溯 evidence

### 第 3 周：Launch Radar 与 Developer Adoption

任务：

- 接入 `producthunt`
- 接入 `devto`
- 接入 `36kr/news`
- 做 launch entity extraction
- 做 entity resolution
- 做 `launch_momentum`
- 做 `developer_adoption_score`
- 做 `GET /signals/launch-radar`

验收：

- 能输出 20 个 launch entities
- 每个 entity 有 source resonance
- 每个 entity 有 GitHub / HN / PH / DEV 至少部分 evidence
- 能输出 competitive overlap 的初版结果

### 第 4 周：迁移、Watchlist、Demo

任务：

- 做 `POST /watchlists`
- 做 `GET /watchlists/{id}/events`
- 做 webhook digest
- 做 OPML import 原型
- 做 analyst console demo
- 出 3 个样板 watchlist

样板 watchlist：

- AI agent evals
- Developer tools launches
- Vector database adoption

验收：

- 用户可订阅 topic / entity / competitor / question cluster
- alert 可通过 webhook 推送
- OPML 能生成迁移建议报告
- demo 能展示 evidence graph

## 8 周强化路径

### 第 5-6 周：质量与护城河

- 增强 comment intelligence
- 增强 entity resolution
- 增强 topic canonicalization
- 增强 source resonance
- 建立人工校准后台
- 建立 signal QA 流程

### 第 7-8 周：商业交付

- CSV / parquet / ndjson 导出
- Slack / 飞书 / Discord 集成
- Team account
- API key / quota
- usage dashboard
- scheduled export
- sample customer reports

## 商业化包装 v3

不要按接口名卖，要按客户任务卖。

### DevRel Intelligence

适合：

- DevRel
- Docs
- Community
- SDK 团队

核心能力：

- question pressure
- docs gap detection
- recurring pain alerts
- source evidence
- weekly action digest

### Product Strategy Intelligence

适合：

- PM
- Founder
- CTO
- Product Marketing

核心能力：

- topic velocity
- question clusters
- competitor launch radar
- developer adoption score
- roadmap opportunity signals

### Content / SEO Intelligence

适合：

- 技术内容团队
- 教育团队
- 增长团队

核心能力：

- high-growth questions
- tutorial gap
- representative questions
- content action digest
- markdown export

### Investor / Scout Intelligence

适合：

- 投研
- AI 工具导航站
- scout

核心能力：

- launch radar
- open-source growth
- cross-community resonance
- startup / product watchlist
- CSV / parquet export

## 套餐建议

### Builder

- `/feed`
- `/topics/trending`
- limited question pressure
- 3 watchlists
- daily digest
- 30 days history

### Pro

- full Question Pressure
- full Launch Radar
- Topic Intelligence
- Evidence API
- webhook
- OPML import
- 90 days history
- CSV / markdown export

### Team

- team workspace
- Slack / Discord / 飞书
- custom watchlists
- competitor tracking
- scheduled reports
- usage dashboard

### Enterprise

- parquet / ndjson / bulk export
- warehouse sync
- custom source mix
- custom topic taxonomy
- advanced quota
- SLA
- dedicated source health report

## 官网首屏建议

不要写：

- All your developer feeds in one place
- AI summarized developer news
- Trend Feed API

建议写：

> Know what developers are struggling with before it becomes your roadmap problem.

或者中文：

> 在开发者需求变成路线图压力之前，提前发现它。

首屏展示三个样例：

- `LangChain eval questions up 2.7x this week`
- `New agent framework gaining adoption across GitHub + HN + Product Hunt`
- `Next.js migration pain cluster detected across Stack Overflow + GitHub Issues`

每个样例都带：

- score
- source mix
- evidence count
- suggested action

## 风险与应对

### 风险 1：被当成 RSS 聚合器

应对：

- 官网不主打 feed
- 产品 demo 不展示标题流
- 首屏只展示 question pressure、launch evidence、developer adoption
- 定价按 signals / watchlists / evidence / export 分层

### 风险 2：被通用趋势工具覆盖

应对：

- 不做泛 trend
- 主打 developer demand
- 强化 GitHub + Stack Overflow + HN + Product Hunt 的组合
- 每个信号给出 action 和 evidence

### 风险 3：GitHub 数据成本和复杂度上升

应对：

- 首版接 OSSInsight / GitHub API / GH Archive
- 只做高价值 topic 和 entity 的增量
- 不追求全量 firehose
- 将自建 event warehouse 放到后续阶段

### 风险 4：信号质量不够

应对：

- 首版可解释规则
- 所有 signal 可回溯 evidence
- 给出 confidence score
- 提供人工校准后台
- 每周做 signal QA

### 风险 5：客户不愿迁移

应对：

- 做 OPML / RSS / keyword import
- 输出迁移报告
- 把 feeds 压缩成 watchlists
- 兼容 webhook / CSV / markdown / Slack

## 最终收敛版本

v3 的最小成立条件：

1. 能稳定跑 `GitHub + Stack Overflow + Hacker News + Product Hunt + Dev.to`
2. 能输出可信的 `question pressure`
3. 能输出带 adoption evidence 的 `launch radar`
4. 能把 topic / entity / question / launch 连接成 evidence graph
5. 能通过 `API + watchlist + digest + webhook + export` 交付
6. 能帮助 Feedly / Inoreader / RSS 用户低成本迁移

如果只保留一句话：

> DevTrend Cloud 不卖信息流，卖 developer demand 的可解释信号。

真正的护城河不是抓取能力本身，而是：

- 开发者源的稳定 OpenCLI adapter 网络
- 持续积累的历史时序数据
- topic canonicalization
- entity resolution
- question clustering
- evidence graph
- customer workflow integration

这套能力成立后，DevTrend Cloud 才会从“另一个趋势工具”变成 AI / DevTool / SDK 公司愿意持续付费的 DaaS 基础设施。

## 调研参考

- Feedly Market Intelligence：https://feedly.com/market-intelligence
- Feedly API：https://developers.feedly.com/
- Inoreader monitoring feeds：https://www.inoreader.com/blog/2026/01/discover-and-monitor-content.html
- Inoreader API：https://www.inoreader.com/developers/
- Common Room integrations：https://www.commonroom.io/pricing/integrations/
- OSSInsight：https://ossinsight.io/
- OSSInsight API：https://ossinsight.io/docs/api
- ProductIntelHub：https://www.productintelhub.com/
- Exploding Topics API：https://explodingtopics.com/feature/et-api
- Trendtracker Trend Radar：https://www.trendtracker.ai/platform/features/trend-radar
- TrendRadar：https://www.trndradar.com/
- Product Hunt API：https://www.producthunt.com/v2/docs
- Stack Exchange API：https://api.stackexchange.com/docs
