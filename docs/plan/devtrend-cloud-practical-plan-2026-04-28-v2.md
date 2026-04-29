# DevTrend Cloud：可落地实践方案 v2

调研与收敛时间：2026-04-28  
适用前提：

- `v2ex` 当前无法稳定通过 public 接口访问，暂不纳入 MVP 主链路
- DevTrend Cloud 不与 RSS 阅读器正面竞争“订阅体验”，而聚焦“机器可消费的趋势信号层”
- 主链路坚持 `public + browserless` 优先，增强链路与销售演示可使用不稳定补充源

## 一句话结论

DevTrend Cloud 应该从“跨站点聚合 API”收敛为：

> 面向 AI 创业团队、开发者工具公司、投研与内容团队的开发者趋势信号层，提供 10 到 30 分钟缓存优先的统一数据、跨源主题对齐、评论洞察、时间序列与告警工作流。

它的真正对手不是单个抓站工具，而是：

- `Folo + RSSHub` 这类“开源订阅前端 + feed 生成层”
- `FreshRSS / Miniflux` 这类自托管 RSS 聚合器
- `Inoreader / Feedly` 这类已经带监测、规则、AI 工作流能力的 RSS SaaS

因此，DevTrend Cloud 不能只卖：

- feed 聚合
- AI 摘要
- 标题列表 API

而必须卖：

- 趋势信号
- 跨源实体对齐
- 历史时间序列
- 评论层洞察
- LLM-ready 数据交付

## 为什么要改版

上一版方案的成立点主要有两个：

- 通过缓存复用，把多站点热门内容做成统一 API
- 用 `全球 + 中文 + AI + 开发者` 的叙事切入市场

这轮调研后，需要修正三点：

1. `/feed` 只能作为低门槛入口，不能作为主壁垒  
`Folo`、`RSSHub`、`FreshRSS`、`Inoreader` 已经能覆盖大量“订阅、聚合、过滤、阅读、轻监测”需求。

2. `v2ex` 暂时不可作为主链路承诺  
因此 MVP 不能再把“中文开发者社区热点”当成核心卖点。

3. DaaS 的核心价值必须从“内容分发”切到“信号生产”  
真正难替代的是：主题速度、跨源共振、评论提炼、问题压力、实体关联、面向 agent 的标准化输出。

## 新定位

### 做什么

- 做开发者与 AI 趋势的统一信号层
- 做缓存优先、结构化优先、机器消费优先的数据产品
- 做可直接接入 agent、RAG、BI、Webhook、日报系统的 API 与工作流

### 不做什么

- 不做通用 RSS 阅读器
- 不做以 UI 阅读体验为核心的内容产品
- 不做“任意站点都能原样抓”的代理层
- 不做秒级实时终端
- 不做第三方全文镜像式再分发

## 与 RSS / Folo 类产品的边界

### 这些能力容易被 RSS 工具替代

- 标题级聚合
- 基础订阅与分类
- 简单关键词监测
- 邮件 digest
- AI 摘要与翻译

### 这些能力不容易被 RSS 工具替代

- 跨站点统一 schema
- 主题 canonicalization
- 评论树级别的观点提炼
- 历史时间序列与 velocity 计算
- “产品/公司/项目/作者/主题”的跨源实体对齐
- 面向 agent 与 RAG 的 LLM-ready 输出
- freshness / confidence / fallback 元信息

结论：

- `feed` 是入口，不是护城河
- `signal`、`entity graph`、`comment intelligence`、`time series` 才是护城河

## 产品边界收敛

### MVP 主链路数据源

| 层级 | 站点 | 角色 | 为什么保留 |
|---|---|---|---|
| Core | `hackernews` | 开发者新闻与项目发现 | 结构稳定，增量清晰，客群广。 |
| Core | `lesswrong` | AI / 理性社区深度观点 | 评论与长文密度高，适合做观点和主题层。 |
| Core | `stackoverflow` | 问题与痛点信号 | 适合做 question pressure 和 unmet demand。 |
| Core | `devto` | 工程实践与创作者层 | 标签和作者维度清晰。 |
| Core | `producthunt` | 新工具 / 新产品发布层 | 适合做 launch radar。 |
| Core-lite | `36kr/news` | 中文科技资讯补充层 | 可作为中文商业与创业背景源。 |
| Support | `lobsters` | 高信噪比工程社区校准层 | 体量小，但适合质量校准。 |

### 暂不进入 MVP 主链路

- `v2ex`
- `36kr/hot`
- `36kr/search`
- `36kr/article`
- `producthunt/browse`
- `producthunt/hot`

原则：

- 可以做 enrich，不绑定 SLA
- 可以用于专题分析和销售 demo
- 不能写进第一版公开承诺

## 新的产品结构

第一版不建议再主打 “Trend Feed API + Watchlist” 的轻量叙事，而是收敛为三个核心产品。

### 产品 1：Topic Intelligence API

核心价值：

- 告诉客户“什么主题在升温”，而不是“今天有哪些帖子”

核心接口：

- `GET /topics/trending`
- `GET /topics/{slug}`
- `GET /topics/{slug}/timeseries`
- `GET /topics/{slug}/sources`
- `GET /topics/{slug}/entities`

关键字段：

- `velocity_1h`
- `velocity_24h`
- `cross_source_spread`
- `source_mix`
- `first_seen_at`
- `peak_seen_at`
- `freshness_minutes`
- `confidence_score`

目标客户：

- VC / 创业研究
- AI 创业团队
- DevRel
- 内容与选题团队

### 产品 2：Question Pressure API

核心价值：

- 告诉客户“开发者正卡在哪些问题上，且问题正在变严重”

数据源：

- `stackoverflow`
- `hackernews/ask`
- `lesswrong/comments` 中的问题型讨论
- `devto/tag` 下的实践类主题

核心接口：

- `GET /signals/question-pressure`
- `GET /signals/question-pressure?topic=ai-agents`
- `GET /signals/question-pressure?framework=nextjs`
- `GET /signals/question-pressure/{cluster_id}`

关键字段：

- `unresolved_volume`
- `question_growth_rate`
- `answer_scarcity`
- `repeat_cluster_count`
- `source_distribution`
- `representative_questions`

目标客户：

- SDK / API 公司
- 文档团队
- Developer tools 公司
- 技术教育与社区团队

### 产品 3：Launch Radar API

核心价值：

- 告诉客户“哪些新工具和新项目正在起势”

数据源：

- `producthunt`
- `hackernews/show`
- `devto`
- `36kr/news`

核心接口：

- `GET /signals/launch-radar`
- `GET /signals/launch-radar?category=developer-tools`
- `GET /signals/launch-radar/{entity_id}`

关键字段：

- `launch_momentum`
- `cross_community_mentions`
- `earliest_seen_source`
- `source_resonance_score`
- `related_entities`

目标客户：

- AI 工具导航站
- 创业团队
- 海外市场团队
- 投研团队

### 保留但降级：Trend Feed API

`/feed` 仍然需要，但角色改为：

- 调试入口
- demo 入口
- 最低价开发者套餐入口

不要把它当成主叙事，也不要围绕它设计品牌心智。

## 核心护城河设计

### 1. Unified Signal Schema

统一输出：

- `item`
- `author`
- `topic`
- `entity`
- `signal`
- `source_snapshot`

核心不是“统一字段”，而是“统一可计算对象”。

### 2. Topic Canonicalization

把这些表达对齐成一个主题：

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

### 3. Comment Intelligence

对 `HN`、`LessWrong`、`Stack Overflow` 重点提取：

- 主要争议点
- 实操经验
- 失败案例
- 共识与分歧
- 高质量评论作者

这部分是相对 RSS 工具最不容易替代的资产。

### 4. Time Series and Freshness

每个主题、实体、来源都必须可回看：

- 1 小时
- 24 小时
- 7 天
- 30 天

并且每次响应都带：

- `cache_fetched_at`
- `freshness_minutes`
- `fallback_used`
- `source_status`

### 5. LLM-ready Export

每个高价值对象支持：

- `markdown`
- `json`
- `csv`
- `parquet`
- `chunked_passages`

这是面向 agent 和 RAG 客户的关键交付，不是可选项。

## 第一版公开承诺

官网和对外文档只承诺以下内容：

1. 绝大多数请求返回 `10-30 分钟` 内缓存
2. 采集失败时优先回退最近一次成功缓存
3. 返回标准化结构、趋势信号和 freshness 元信息
4. 支持 watchlist、digest、webhook 等工作流接入

不承诺：

- 秒级实时
- 全文覆盖
- 全站可用
- 所有站点所有命令高可用

## 工程落地方案

### 数据采集

- `cron / worker` 定时执行 `opencli <site> <command> -f json`
- 每个源独立调度，避免单源失败拖垮全局
- 所有列表型接口先做增量快照，再做标准化

建议 TTL：

- `hackernews top/new/ask/show`：`10 分钟`
- `lesswrong frontpage/new/curated/shortform`：`15 分钟`
- `stackoverflow hot/unanswered/bounties/search`：`15-30 分钟`
- `devto top/tag`：`20-30 分钟`
- `producthunt posts/today`：`15 分钟`
- `36kr/news`：`20 分钟`
- `author / user / tag metadata`：`6-24 小时`

### 存储结构

- `Redis`：热缓存
- `Postgres`：标准化实体、主题、信号、响应快照索引
- 对象存储：原始 JSON、历史归档、批量导出文件

### 表设计建议

- `raw_snapshots`
- `items`
- `authors`
- `topics`
- `entities`
- `item_topics`
- `item_entities`
- `signals_topic_daily`
- `signals_entity_daily`
- `watchlists`
- `watchlist_events`

### 信号计算层

首版就做 6 个指标：

1. `topic_velocity`
2. `cross_source_spread`
3. `question_pressure`
4. `launch_momentum`
5. `discussion_depth`
6. `author_influence`

首版不要上复杂黑箱模型，优先规则加轻量打分。

## 4 周执行路径

### 第 1 周：主链路可跑通

- 跑通 `hackernews`、`lesswrong`、`stackoverflow`
- 建立 `raw -> normalized -> cache` 基础流水线
- 设计 `item / topic / signal` 最小 schema
- 打通 `GET /feed`、`GET /topics/trending`

验收标准：

- 每个源至少 3 个稳定命令入库
- API 响应包含 freshness 元信息
- 有基础失败日志和 last success

### 第 2 周：信号层可用

- 上 `topic_velocity`
- 上 `cross_source_spread`
- 上 `question_pressure`
- 接入 `producthunt` 与 `36kr/news`

验收标准：

- 能输出过去 24 小时 top topics
- 能输出 topic 的来源构成
- 能输出至少 20 个问题簇

### 第 3 周：工作流与 watchlist

- 做 `POST /watchlists`
- 做 `GET /watchlists/{id}/events`
- 做邮件或 webhook digest
- 上简单阈值规则告警

验收标准：

- 用户可订阅 topic / keyword / entity
- 新事件可写入 watchlist events
- 可以每日汇总推送

### 第 4 周：对外 demo 版

- 补 `devto`、`lobsters`
- 做 Topic 页和 Entity 页 demo
- 做 Launch Radar demo
- 出 3 个行业样板 watchlist

建议样板：

- `AI agents`
- `vibe coding`
- `developer tools launches`

## 8 周执行路径

### 第 5-6 周：评论层与实体层

- 做评论抽取与观点摘要
- 做 entity resolution
- 做 source resonance 计算

### 第 7-8 周：面向客户的可交付层

- CSV / parquet 导出
- Slack / 飞书 / Discord webhook
- 团队账户与配额
- usage dashboard

## 商业化建议

### 首批客户画像

优先顺序建议：

1. AI 创业团队
2. Developer tools 公司
3. 技术内容与研究团队
4. 小型投研团队

不建议第一批就打大而全媒体监测市场，因为会被 `Feedly / Inoreader` 的泛能力拖进价格战。

### 第一版套餐

#### Builder

- `/feed`
- `/topics/trending`
- 限量 watchlist
- 日级 digest

#### Pro

- `Topic Intelligence`
- `Question Pressure`
- `Launch Radar`
- webhook
- 历史回看

#### Enterprise

- parquet / bulk export
- 专属 watchlist
- 定制 source mix
- 高级配额与 SLA

## 风险与应对

### 风险 1：被当成“另一个 RSS 聚合器”

应对：

- 官网首页不主打 feed
- 首屏只展示 topic、signal、velocity、question pressure
- 定价页按 signal 和 watchlist 分层，而不是按订阅源数量分层

### 风险 2：中文侧价值下降

应对：

- 短期接受这一现实
- 以 `36kr/news` 维持中文商业背景层
- 等 `v2ex` 或其他稳定 public 中文源恢复后再扩

### 风险 3：源稳定性不够

应对：

- 所有接口带 freshness 与 fallback
- source health 面板首版就做
- enrich 源不进入主承诺

### 风险 4：信号质量不够

应对：

- 首版用可解释规则
- 每个 signal 可回溯到底层样本
- 允许人工校验和阈值调优

## 最终收敛版本

如果只保留一句最重要的话，这版实践方案的核心是：

> 不再做“开发者内容聚合器”，而做“开发者与 AI 趋势信号基础设施”。

MVP 最小成立条件不是“源很多”，而是以下四件事同时成立：

1. 能稳定跑 `HN + LessWrong + Stack Overflow + Product Hunt + 36kr/news`
2. 能输出 `topic velocity / question pressure / launch momentum`
3. 能把结果通过 `API + watchlist + digest + webhook` 交付出去
4. 每条数据都带 freshness、fallback 和 source health

满足这四条，DevTrend Cloud 才会和 `Folo / RSSHub / FreshRSS / Inoreader` 真正拉开产品层级差距。
