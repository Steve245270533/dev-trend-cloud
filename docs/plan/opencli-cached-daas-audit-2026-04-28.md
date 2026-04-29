# OpenCLI 渠道盘点与 Cached DaaS 商业化方案

调研时间：2026-04-28  
调研方式：基于本机已安装 `opencli` 执行 `opencli list -f json`，对全部站点渠道与指令做归类和筛选。  
筛选规则：优先 `PUBLIC`，同时参考结构化输出、可增量、跨客户复用、二次加工空间、无登录依赖、关键指令护城河。

## 一句话结论

如果目标是做 **public 接口为主** 的 **Cached DaaS**，最值得优先商业化的不是“泛搜索”或“泛新闻”，而是这 6 类：

1. **金融市场公共数据**：`eastmoney`、`binance`、`sinafinance`
2. **开发者/AI 社区趋势数据**：`hackernews`、`v2ex`、`lesswrong`、`lobsters`、`stackoverflow`、`devto`
3. **公共社交图谱与话题传播**：`bluesky`
4. **政策法规监测**：`gov-policy`、`gov-law`
5. **科研论文与知识图谱**：`arxiv`、`google-scholar`、`baidu-scholar`、`wanfang`
6. **求职与技能热度**：`nowcoder`

其中，**最适合直接起步做 Cached DaaS 的站点 Top 8** 是：

1. `eastmoney`
2. `binance`
3. `bluesky`
4. `hackernews`
5. `v2ex`
6. `gov-policy`
7. `gov-law`
8. `arxiv`

`lesswrong` 的技术适配度非常高，但更适合做 **AI/理性社区情报的垂直产品**，不一定是最广谱的第一商业优先级。  
`nowcoder` 的商业潜力不错，但它是 **mixed public**，不是“纯 public 优先”的最佳起手。  
`google`、`bloomberg`、`36kr`、`producthunt` 更适合做补充源，而不是主数据底座。

## 全量概览

- 共发现 **103** 个站点渠道
- 共发现 **628** 条指令
- 其中 `PUBLIC` 指令 **165** 条
- `PUBLIC only` 站点 **27** 个
- `mixed public` 站点 **14** 个
- `auth only` 站点 **62** 个
- `browserless only` 站点 **19** 个

按策略统计：

| Strategy | Commands |
|---|---:|
| `cookie` | 368 |
| `public` | 165 |
| `ui` | 80 |
| `intercept` | 10 |
| `local` | 4 |
| `header` | 1 |

## 选型原则

我把你给的 6 条规则映射成了实操判断标准：

1. **结构化输出优先**：返回列表、实体、时间序列、图谱节点，比 UI 操作、发帖/点赞类动作更适合缓存。
2. **天然可增量**：有 `recent`、`new`、`latest`、`hot`、`top`、`trending`、`search`、`feed`、`rank`、`kline` 这类指令的，适合做 delta。
3. **跨客户复用高**：越像“公共榜单/公共市场/公共资讯/公共社区”，越适合一份缓存服务 N 个客户。
4. **可做二次加工**：可做去重、聚类、标签化、实体对齐、趋势指数、关系图谱、事件流。
5. **核心能力不依赖登录**：至少最值钱的数据，不该建立在 cookie 会话之上。
6. **关键指令能构成壁垒**：不是单条 `search` 就结束，而是能组合出“连续观测 + 关系分析 + 指数产品”。

## 最适合做 Cached DaaS 的站点数据源

### S 级：立刻可产品化

| Rank | Site | Public Cmds | 为什么适合 |
|---|---|---:|---|
| 1 | `eastmoney` | 13 | 金融实体、排行、板块、公告、资金流、K 线齐全，天然适合缓存和衍生指数。 |
| 2 | `binance` | 11 | 行情、交易对、K 线、深度、成交、涨跌榜完整，刷新频率清晰，跨客户复用极高。 |
| 3 | `bluesky` | 9 | 公开社交图谱、帖子线程、趋势、关注关系都能抓，特别适合做 narrative intelligence。 |
| 4 | `hackernews` | 8 | `top/new/ask/show/jobs/search/user` 很完整，是开发者趋势和项目发现的优质公共源。 |
| 5 | `v2ex` | 8 | 中文开发者社区里少有的 public 结构化源，适合中文技术趋势、节点热度、用户画像。 |
| 6 | `gov-policy` | 2 | 指令少但价值高，面向企业客户的政策监测、行业影响分析、区域政策情报很容易卖。 |
| 7 | `gov-law` | 2 | 法规更新和法规搜索具备强复用与高付费意愿，适合做合规与法律情报缓存层。 |
| 8 | `arxiv` | 2 | 指令少，但“论文详情 + 搜索”足以支撑科研/AI 论文监测、主题图谱、作者网络产品。 |

### A 级：强补充源，适合并入组合产品

| Site | Public Cmds | 适合扮演的角色 |
|---|---:|---|
| `lesswrong` | 15 | AI/理性社区垂直情报；技术适配度极高，但客群更垂直。 |
| `nowcoder` | 7 | 人才供需与技能热度补充源；适合做“校招/技术岗位/面试内容”趋势。 |
| `bloomberg` | 9 | 财经新闻补充源；更像资讯流，二次加工空间不如行情/公告。 |
| `google` | 4 | 可做需求侧信号层，如 `trends`、`suggest`；但泛搜索结果的跨客户复用较弱。 |
| `sinafinance` | 2 | 金融快讯与行情补充源；适合作为 Eastmoney 的校验与新闻补充。 |
| `producthunt` | 2 | 新产品上线雷达；适合创业/出海情报。 |
| `36kr` | 3 | 中文科技新闻热榜和搜索；适合中国创业情报补充层。 |
| `stackoverflow` | 4 | 问题热度、悬赏、未解问题，可做开发者痛点指数。 |
| `lobsters` | 4 | 小而高信噪比的英文技术社区补充层。 |
| `devto` | 3 | 标签与作者维度清晰，适合做工程实践内容补充。 |

### B 级：不建议作为第一批 Cached DaaS 主底座

- `spotify`：虽然是 public 且 browserless，但本质是控制类指令，不是可复用公共数据源。
- `chatgpt-app`：是本地 App 自动化，不是网站数据源。
- `paperreview`：更像单任务服务接口，不是共享型公共缓存池。
- `dictionary`：高结构化但商业单价低、复用价值有限。
- `ctrip`：只有联想搜索，不足以形成高壁垒产品。
- `imdb`：能做娱乐数据，但你明确说了暂不考虑视频相关重资源生态，优先级下降。

## 每个推荐站点的关键指令与产品化方向

### 1. `eastmoney`

关键指令：

- `announcement`
- `quote`
- `kline`
- `rank`
- `sectors`
- `money-flow`
- `northbound`
- `longhu`
- `holders`
- `index-board`
- `etf`
- `convertible`
- `kuaixun`

为什么强：

- 同时覆盖 **实体层**（股票、ETF、可转债、板块、指数）
- 同时覆盖 **事件层**（公告、龙虎榜、快讯）
- 同时覆盖 **时间序列层**（K 线、资金流、北向/南向）
- 可做“市场快照缓存 + 多周期因子 + 主题板块图谱 + 异动预警”

适合落地的 Cached DaaS 产品形态：

- **Market Snapshot API**：分钟级缓存的市场横截面快照
- **Event & Flow API**：公告、资金流、龙虎榜事件流
- **Sector Intelligence API**：板块热度、轮动、主题强弱评分

商业变现：

- 卖给量化研究、投顾内容团队、金融媒体、券商投研外包团队、企业 IR
- 计费方式优先：`包月订阅 + API 调用量 + 历史回补包`
- 建议定价：`¥4,999/月` 起的标准版，`¥20,000+/月` 的企业版

### 2. `binance`

关键指令：

- `pairs`
- `prices`
- `price`
- `ticker`
- `top`
- `gainers`
- `losers`
- `klines`
- `depth`
- `asks`
- `trades`

为什么强：

- 数据天然高频、标准化、跨客户复用极强
- `price + ticker + klines + trades + depth` 足以做完整缓存层
- 能做统一品种字典、成交热度、波动率、盘口强弱、异动检测

适合落地的 Cached DaaS 产品形态：

- **Crypto Market Cache API**
- **Top Movers / Trend API**
- **Intraday Signal Feed**

商业变现：

- 卖给交易工具、资讯终端、量化研究团队、KOL 工具、投教内容平台
- 风险在于同类竞争多，必须靠 **衍生信号** 而不是原始行情本身
- 定价更适合走：`低门槛开发者版 + 高频企业版`

### 3. `bluesky`

关键指令：

- `trending`
- `thread`
- `feeds`
- `search`
- `profile`
- `user`
- `followers`
- `following`
- `starter-packs`

为什么强：

- 不是只有“帖子列表”，而是具备 **图谱关系**
- 可做作者、话题、传播链、社区入口、推荐源之间的映射
- `starter-packs` 和 `feeds` 很适合做社区生态图

适合落地的 Cached DaaS 产品形态：

- **Narrative Tracking API**
- **Influencer / Graph API**
- **Community Discovery API**

商业变现：

- 卖给出海团队、品牌舆情团队、投研团队、AI 创业情报团队
- 适合附加高毛利功能：`主题聚类`、`影响力分层`、`传播路径`

### 4. `hackernews`

关键指令：

- `top`
- `new`
- `best`
- `ask`
- `show`
- `jobs`
- `search`
- `user`

为什么强：

- delta 非常清晰，缓存难度低
- 客群广：开发者、投资人、产品经理、AI 创业团队
- 可做“话题上升速度”“链接域名热度”“岗位热度”“作者影响力”

适合落地的 Cached DaaS 产品形态：

- **HN Trend API**
- **Developer News Cache**
- **AI Startup Signal Feed**

商业变现：

- 适合做低价开发者产品切入，再向团队版升级
- 与 `producthunt`、`lesswrong`、`36kr` 组合后价值更高

### 5. `v2ex`

关键指令：

- `hot`
- `latest`
- `node`
- `nodes`
- `topic`
- `replies`
- `member`
- `user`

为什么强：

- 中文开发者社区里，public 且结构化程度较高
- `node/nodes` 让主题分类非常自然，适合长期缓存
- 可做“中文技术栈趋势”“城市/远程/外包/副业话题热度”

适合落地的 Cached DaaS 产品形态：

- **China Dev Trend API**
- **Node Heat Index**
- **Community Pain Point Feed**

商业变现：

- 卖给招聘平台、开发者工具、内容团队、技术媒体
- 与 `nowcoder` 组合后，可形成“技术讨论 + 招聘需求”双视角产品

### 6. `gov-policy` + `gov-law`

关键指令：

- `gov-policy/recent`
- `gov-policy/search`
- `gov-law/recent`
- `gov-law/search`

为什么强：

- 指令不多，但商业价值非常高
- 政策和法规是天然“公共数据 + 多客户复用 + 高频搜索 + 高付费”
- 可做行业标签、区域标签、监管主题、政策时间线、法规变更差分

适合落地的 Cached DaaS 产品形态：

- **Policy Monitor API**
- **Regulation Delta Feed**
- **Industry Compliance Radar**

商业变现：

- 卖给咨询公司、园区服务、产业研究、法律科技、合规 SaaS、政府关系团队
- 适合走 `高客单价企业版 + 定制报告 + Webhook 预警`
- 这类数据源的单位客户价值，通常高于开发者社区数据

### 7. `arxiv`

关键指令：

- `paper`
- `search`

为什么仍然值得做：

- 虽然只有 2 条，但都是主干能力
- 适合缓存“论文实体”而不是只缓存搜索结果
- 容易做作者、机构、主题词、引用代理特征、时间趋势

适合落地的 Cached DaaS 产品形态：

- **Paper Graph API**
- **AI Research Monitor**
- **Topic Emergence Feed**

商业变现：

- 卖给 AI 团队、科研工具、VC、咨询、产业研究
- 需要与 `google-scholar`、`baidu-scholar`、`wanfang` 联合，增强作者和中文覆盖

### 8. `nowcoder`

关键 public 指令：

- `companies`
- `creators`
- `hot`
- `jobs`
- `recommend`
- `topics`
- `trending`

为什么值得关注：

- 求职、校招、面经、技能热词，本身就是高商业价值主题
- `jobs + topics + hot + trending` 能做“岗位需求热度”和“技能讨论热度”
- 不足是站点整体并非 pure public

适合落地的 Cached DaaS 产品形态：

- **Talent Demand Index**
- **Campus Hiring Radar**
- **Skill Heat API**

商业变现：

- 卖给招聘 SaaS、教育培训、职业内容平台、雇主品牌团队
- 更适合作为第二批产品线

## 推荐的“可落地产品形态”

这里不建议“一个站点卖一个 API”，而是建议直接做 **组合型 Cached DaaS SKU**。

### 方案 A：FinPulse

数据源：

- `eastmoney`
- `binance`
- `sinafinance`

卖点：

- 一个统一接口返回 A 股、港股、美股、ETF、可转债、Crypto 的缓存快照
- 附带排行、公告、资金流、板块轮动、异动检测

可售卖形态：

- REST API
- Webhook 预警
- 每日/每小时 parquet 快照
- Dashboard

客户：

- 金融自媒体
- 券商内容团队
- 量化研究工具
- 投资社区

### 方案 B：DevTrend Cloud

数据源：

- `hackernews`
- `v2ex`
- `lesswrong`
- `lobsters`
- `stackoverflow`
- `devto`
- `producthunt`
- `36kr`

卖点：

- 把“开发者讨论、AI 观点、问题痛点、新产品上线、中文科技资讯”统一成一个主题流
- 支持主题聚类、上升速度、关键词共现、作者影响力

可售卖形态：

- Trend API
- Daily digest
- Slack / Lark / WeCom 机器人
- 投资/产品情报面板

客户：

- AI 创业团队
- 开发者工具公司
- VC/FA
- 技术媒体

### 方案 C：PolicyIntel

数据源：

- `gov-policy`
- `gov-law`

卖点：

- 面向企业客户的政策法规更新缓存层
- 做行业标签、地理标签、监管主题、差分跟踪、法规生效时间线

可售卖形态：

- Compliance API
- 企业监控台
- 行业主题邮件/飞书推送
- 定制法规库

客户：

- 合规 SaaS
- 咨询公司
- 园区与产业服务
- 法律科技

### 方案 D：ResearchGraph

数据源：

- `arxiv`
- `google-scholar`
- `baidu-scholar`
- `wanfang`

卖点：

- 英文前沿论文 + 中文学术补全
- 做作者画像、主题演化、机构分布、研究前沿监测

可售卖形态：

- Paper metadata API
- Topic watchlist
- 研究趋势简报
- 企业研发情报后台

客户：

- AI 公司
- 研究院
- 咨询公司
- 投研机构

### 方案 E：TalentSignal

数据源：

- `nowcoder`
- `v2ex`

卖点：

- 招聘需求和技术讨论热度联动
- 能做技能关键词、岗位类别、校招热度、讨论情绪、面试密度

可售卖形态：

- 招聘趋势 API
- 技能热力榜
- 企业雇主品牌监测

客户：

- 招聘平台
- 教培机构
- 雇主品牌团队
- 人才咨询公司

## 我建议的商业优先级

如果你要从 0 到 1 起盘，我会这样排：

1. **先做 `eastmoney` / `binance` / `sinafinance` 的 FinPulse**
2. **并行做 `hackernews` / `v2ex` / `lesswrong` / `producthunt` 的 DevTrend Cloud**
3. **用 `gov-policy` / `gov-law` 打企业高客单价单子**
4. **再扩到 `arxiv` / `google-scholar` / `wanfang`**
5. **最后再做 `nowcoder` 这类半 public 垂直补充**

原因：

- 金融和政策数据最容易形成“高频调用 + 企业付费”
- 开发者/AI 趋势数据最容易先做出产品口碑和分发
- 科研/人才数据更适合作为第二增长曲线

## 护城河不该建立在哪

不建议把护城河建立在下面这些点上：

- 只卖原始 `search` 结果
- 只卖“站点直出列表”而不做加工
- 依赖 cookie 会话才能跑通的核心能力
- 视频/音频转码、下载这类高 CPU/高带宽任务
- UI 自动化写操作

真正的护城河应该是：

- **跨站点实体对齐**
- **统一 schema**
- **缓存层和增量层**
- **趋势指数与事件评分**
- **主题聚类与关系图谱**
- **告警与工作流集成**

## 建议的首批 API 设计

建议不要暴露“站点命令镜像”，而是暴露“业务对象 API”：

- `/entities/securities`
- `/timeseries/kline`
- `/events/announcements`
- `/events/policy-deltas`
- `/topics/trending`
- `/communities/posts`
- `/papers/search`
- `/signals/theme-velocity`
- `/signals/attention-shift`

这样前端和客户不会被站点差异绑住，后续扩源也更容易。

## 全量站点渠道与全部指令附录

以下附录是基于当前本机 `opencli list -f json` 的全量清单整理，便于后续继续筛选。

| Site | Cmds | Public | Strategy | Browserless | Commands |
|---|---:|---:|---|---|---|
| 1688 | 5 | 0 | cookie | partial/no | assets, download, item, search, store |
| 36kr | 4 | 3 | intercept/public | partial/no | article, hot, news, search |
| 51job | 4 | 0 | cookie | partial/no | company, detail, hot, search |
| amazon | 7 | 0 | cookie | partial/no | bestsellers, discussion, movers-shakers, new-releases, offer, product, search |
| antigravity | 8 | 0 | ui | partial/no | dump, extract-code, model, new, read, send, status, watch |
| apple-podcasts | 3 | 3 | public | yes | episodes, search, top |
| arxiv | 2 | 2 | public | yes | paper, search |
| baidu-scholar | 1 | 1 | public | partial/no | search |
| band | 4 | 0 | cookie/intercept | partial/no | bands, mentions, post, posts |
| barchart | 4 | 0 | cookie | partial/no | flow, greeks, options, quote |
| bbc | 1 | 1 | public | yes | news |
| bilibili | 15 | 0 | cookie | partial/no | comments, download, dynamic, favorite, feed, feed-detail, following, history, hot, me, ranking, search, subtitle, user-videos, video |
| binance | 11 | 11 | public | yes | asks, depth, gainers, klines, losers, pairs, price, prices, ticker, top, trades |
| bloomberg | 10 | 9 | cookie/public | partial/no | businessweek, economics, feeds, industries, main, markets, news, opinions, politics, tech |
| bluesky | 9 | 9 | public | yes | feeds, followers, following, profile, search, starter-packs, thread, trending, user |
| boss | 14 | 0 | cookie | partial/no | batchgreet, chatlist, chatmsg, detail, exchange, greet, invite, joblist, mark, recommend, resume, search, send, stats |
| chaoxing | 2 | 0 | cookie | partial/no | assignments, exams |
| chatgpt | 1 | 0 | cookie | partial/no | image |
| chatgpt-app | 6 | 6 | public | yes | ask, model, new, read, send, status |
| chatwise | 6 | 0 | ui | partial/no | ask, export, history, model, read, send |
| cnki | 1 | 0 | cookie | partial/no | search |
| codex | 7 | 0 | ui | partial/no | ask, export, extract-diff, history, model, read, send |
| coupang | 2 | 0 | cookie | partial/no | add-to-cart, search |
| ctrip | 1 | 1 | public | yes | search |
| cursor | 8 | 0 | ui | partial/no | ask, composer, export, extract-code, history, model, read, send |
| deepseek | 5 | 0 | cookie | partial/no | ask, history, new, read, status |
| devto | 3 | 3 | public | yes | tag, top, user |
| dictionary | 3 | 3 | public | yes | examples, search, synonyms |
| discord-app | 8 | 0 | ui | partial/no | channels, delete, members, read, search, send, servers, status |
| douban | 9 | 0 | cookie | partial/no | book-hot, download, marks, movie-hot, photos, reviews, search, subject, top250 |
| doubao | 9 | 0 | cookie | partial/no | ask, detail, history, meeting-summary, meeting-transcript, new, read, send, status |
| doubao-app | 7 | 0 | ui | partial/no | ask, dump, new, read, screenshot, send, status |
| douyin | 13 | 0 | cookie | partial/no | activities, collections, delete, draft, drafts, hashtag, location, profile, publish, stats, update, user-videos, videos |
| eastmoney | 14 | 13 | cookie/public | partial/no | announcement, convertible, etf, holders, hot-rank, index-board, kline, kuaixun, longhu, money-flow, northbound, quote, rank, sectors |
| facebook | 10 | 0 | cookie | partial/no | add-friend, events, feed, friends, groups, join-group, memories, notifications, profile, search |
| gemini | 5 | 0 | cookie | partial/no | ask, deep-research, deep-research-result, image, new |
| gitee | 3 | 3 | public | partial/no | search, trending, user |
| google | 4 | 4 | public | partial/no | news, search, suggest, trends |
| google-scholar | 1 | 1 | public | partial/no | search |
| gov-law | 2 | 2 | public | partial/no | recent, search |
| gov-policy | 2 | 2 | public | partial/no | recent, search |
| grok | 1 | 0 | cookie | partial/no | ask |
| hackernews | 8 | 8 | public | yes | ask, best, jobs, new, search, show, top, user |
| hf | 1 | 1 | public | yes | top |
| hupu | 7 | 2 | cookie/public | partial/no | detail, hot, like, mentions, reply, search, unlike |
| imdb | 6 | 6 | public | partial/no | person, reviews, search, title, top, trending |
| instagram | 19 | 0 | cookie/ui | partial/no | comment, download, explore, follow, followers, following, like, note, post, profile, reel, save, saved, search, story, unfollow, unlike, unsave, user |
| jd | 6 | 0 | cookie | partial/no | add-cart, cart, detail, item, reviews, search |
| jianyu | 2 | 0 | cookie | partial/no | detail, search |
| jike | 10 | 0 | cookie/ui | partial/no | comment, create, feed, like, notifications, post, repost, search, topic, user |
| jimeng | 4 | 0 | cookie | partial/no | generate, history, new, workspaces |
| ke | 4 | 0 | cookie | partial/no | chengjiao, ershoufang, xiaoqu, zufang |
| lesswrong | 15 | 15 | public | yes | comments, curated, frontpage, new, read, sequences, shortform, tag, tags, top, top-month, top-week, top-year, user, user-posts |
| linkedin | 2 | 0 | cookie/header | partial/no | search, timeline |
| linux-do | 11 | 0 | cookie | partial/no | categories, category, feed, hot, latest, search, tags, topic, topic-content, user-posts, user-topics |
| lobsters | 4 | 4 | public | yes | active, hot, newest, tag |
| maimai | 1 | 0 | cookie | partial/no | search-talents |
| medium | 3 | 0 | cookie | partial/no | feed, search, user |
| mubu | 5 | 0 | cookie | partial/no | doc, docs, notes, recent, search |
| notebooklm | 13 | 0 | cookie | partial/no | current, get, history, list, note-list, notes-get, open, source-fulltext, source-get, source-guide, source-list, status, summary |
| notion | 8 | 0 | ui | partial/no | export, favorites, new, read, search, sidebar, status, write |
| nowcoder | 16 | 7 | cookie/public | partial/no | companies, creators, detail, experience, hot, jobs, notifications, papers, practice, recommend, referral, salary, search, suggest, topics, trending |
| ones | 8 | 0 | cookie | partial/no | login, logout, me, my-tasks, task, tasks, token-info, worklog |
| paperreview | 3 | 3 | public | yes | feedback, review, submit |
| pixiv | 6 | 0 | cookie | partial/no | detail, download, illusts, ranking, search, user |
| powerchina | 1 | 0 | cookie | partial/no | search |
| producthunt | 4 | 2 | intercept/public | partial/no | browse, hot, posts, today |
| quark | 7 | 0 | cookie | partial/no | ls, mkdir, mv, rename, rm, save, share-tree |
| reddit | 15 | 0 | cookie | partial/no | comment, frontpage, hot, popular, read, save, saved, search, subreddit, subscribe, upvote, upvoted, user, user-comments, user-posts |
| reuters | 1 | 0 | cookie | partial/no | search |
| sinablog | 4 | 1 | cookie/public | partial/no | article, hot, search, user |
| sinafinance | 4 | 2 | cookie/public | partial/no | news, rolling-news, stock, stock-rank |
| smzdm | 1 | 0 | cookie | partial/no | search |
| spotify | 11 | 11 | public | yes | auth, next, pause, play, prev, queue, repeat, search, shuffle, status, volume |
| stackoverflow | 4 | 4 | public | yes | bounties, hot, search, unanswered |
| steam | 1 | 1 | public | yes | top-sellers |
| substack | 3 | 1 | cookie/public | partial/no | feed, publication, search |
| taobao | 5 | 0 | cookie | partial/no | add-cart, cart, detail, reviews, search |
| tdx | 1 | 0 | cookie | partial/no | hot-rank |
| ths | 1 | 0 | cookie | partial/no | hot-rank |
| tieba | 4 | 1 | cookie/public | partial/no | hot, posts, read, search |
| tiktok | 15 | 0 | cookie | partial/no | comment, explore, follow, following, friends, like, live, notifications, profile, save, search, unfollow, unlike, unsave, user |
| toutiao | 1 | 0 | cookie | partial/no | articles |
| twitter | 30 | 0 | cookie/intercept/ui | partial/no | accept, article, block, bookmark, bookmarks, delete, download, follow, followers, following, hide-reply, like, likes, list-add, list-remove, list-tweets, lists, notifications, post, profile, reply, reply-dm, search, thread, timeline, trending, tweets, unblock, unbookmark, unfollow |
| uiverse | 2 | 2 | public | partial/no | code, preview |
| v2ex | 11 | 8 | cookie/public | partial/no | daily, hot, latest, me, member, node, nodes, notifications, replies, topic, user |
| wanfang | 1 | 1 | public | partial/no | search |
| web | 1 | 0 | cookie | partial/no | read |
| weibo | 7 | 0 | cookie | partial/no | comments, feed, hot, me, post, search, user |
| weixin | 3 | 0 | cookie | partial/no | create-draft, download, drafts |
| weread | 8 | 2 | cookie/public | partial/no | ai-outline, book, highlights, notebooks, notes, ranking, search, shelf |
| wikipedia | 4 | 4 | public | yes | random, search, summary, trending |
| xianyu | 3 | 0 | cookie | partial/no | chat, item, search |
| xiaoe | 5 | 0 | cookie | partial/no | catalog, content, courses, detail, play-url |
| xiaohongshu | 13 | 0 | cookie/intercept | partial/no | comments, creator-note-detail, creator-notes, creator-notes-summary, creator-profile, creator-stats, download, feed, note, notifications, publish, search, user |
| xiaoyuzhou | 5 | 1 | local/public | yes | download, episode, podcast, podcast-episodes, transcript |
| xueqiu | 12 | 0 | cookie | partial/no | comments, earnings-date, feed, fund-holdings, fund-snapshot, groups, hot, hot-stock, kline, search, stock, watchlist |
| yahoo-finance | 1 | 0 | cookie | partial/no | quote |
| yollomi | 12 | 1 | cookie/public | partial/no | background, edit, face-swap, generate, models, object-remover, remove-bg, restore, try-on, upload, upscale, video |
| youtube | 14 | 0 | cookie | partial/no | channel, comments, feed, history, like, playlist, search, subscribe, subscriptions, transcript, unlike, unsubscribe, video, watch-later |
| yuanbao | 2 | 0 | cookie | partial/no | ask, new |
| zhihu | 9 | 0 | cookie/ui | partial/no | answer, comment, download, favorite, follow, hot, like, question, search |
| zsxq | 5 | 0 | cookie | partial/no | dynamics, groups, search, topic, topics |
