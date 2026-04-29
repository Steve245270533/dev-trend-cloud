# Phase 0 + Phase 1 Audit (2026-04-29)

本报告记录一次基于真实环境的 Phase 0 + Phase 1 完整性审查，目标是为后续修复提供可直接执行的依据，而不是重复做一次高层方案复述。

## 审查结论

当前仓库不能判定为“已完整且正确无误覆盖 Phase 0 + Phase 1”。

- 优点：
  - monorepo、migration、seed、API、worker、domain pipeline、Redis cache 的主干结构已具备
  - `pnpm lint` 通过
  - `pnpm test` 通过，当前测试集 `21/21`
  - 真实环境下 `db:migrate`、`db:seed`、`audit:contracts` 可运行
  - 真实数据库 + Redis + API 可形成一条从采样到查询的主链路
- 结论：
  - 代码骨架基本完成
  - 真实运行质量、失败回退、证据追踪和跨源压缩质量还不足以支撑“Phase 1 已完成验收”

建议把当前状态理解为：

```text
主链路已打通，但仍处于“可运行的 MVP 骨架 + 真实源质量补齐期”。
```

## 本次验证范围

### 1. 文档与范围核对

对照：

- `AGENTS.md`
- `architecture.md`
- `docs/development.md`
- `docs/api.md`
- `docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md`

注意到一个范围冲突：

- `v4` 文档前部列出了 `watchlists / digest / webhook` 形态
- 仓库入口文档与子包文档明确把 watchlist CRUD、digest/webhook 交付排除在当前阶段之外

本次审查按“仓库入口文档 + v4 中 Phase 0 / Phase 1 任务与验收条目”来评估实现状态。

### 2. 静态检查

执行：

```bash
pnpm lint
pnpm typecheck
pnpm test
```

结果：

- `pnpm lint` 通过
- `pnpm test` 通过，`21/21`
- `pnpm typecheck` 在本次终端中已跑到子测试包 typecheck 阶段，未见错误输出；本轮没有拿到完整收尾回显，因此不把它单独作为最终验收依据

### 3. 真实基础设施

实测环境：

- Postgres 容器：`project-postgres`
- Redis 容器：`project-redis`
- OpenCLI 可执行：`/opt/homebrew/bin/opencli`

执行：

```bash
pnpm db:migrate
pnpm db:seed
pnpm audit:contracts
```

结果：

- migration 成功
- seed 成功，写入 demo 数据
- contract audit 成功，产出 `docs/reports/contract-audit/latest.json`

### 4. 真实接口验证

用真实数据库启动 API 后，实测如下接口：

- `GET /healthz`
- `GET /readyz`
- `GET /feed`
- `GET /feed?source=ossinsight`
- `GET /feed?topic=vector-databases`
- `GET /signals/question-pressure`
- `GET /signals/question-pressure?entity=anthropic`
- `GET /signals/question-pressure?topic=vector-databases`
- `GET /question-clusters/:clusterId`
- `GET /question-clusters/:clusterId/evidence`
- 错误路径：
  - `GET /question-clusters/00000000-0000-0000-0000-000000000000`
  - `GET /feed?limit=999`
  - `GET /signals/question-pressure?limit=0`

结果：

- 所有已实现只读接口都能返回响应
- 404 / 400 错误路径也正常工作
- Redis 中确实出现了缓存键：
  - `devtrend:feed:*`
  - `devtrend:question-pressure:*`
- TTL 正常递减，符合 `CACHE_TTL_MINUTES=15`

### 5. PostgreSQL / Redis 数据核验

本次没有只停留在 demo seed。

处理方式：

1. 跑真实 contract audit
2. 清空 runtime tables
3. 把 `docs/reports/contract-audit/latest.json` 中的真实样本重新灌入 pipeline
4. 再从 Postgres / API / Redis 三侧交叉核验

真实样本入库后，数据库状态为：

- `items = 83`
- `signals = 22`
- `source_runs = 17`
- `raw_snapshots = 17`
- `source_health = 4`

按 source 分布：

- `devto = 10`
- `hackernews = 14`
- `ossinsight = 40`
- `stackoverflow = 19`

## 已确认可用的部分

### 1. Phase 0 合约审计骨架可用

真实 `opencli` 命令可以执行，且本轮 audit 覆盖了当前 registry 中配置的 `17` 个命令样本。

包括：

- Stack Overflow：
  - `hot`
  - `unanswered`
  - `bounties`
  - `search`
- Hacker News：
  - `ask`
  - `top`
  - `search`
- DEV：
  - `top`
  - `tag`
- OSSInsight：
  - `trending`
  - `collections`
  - `hot-collections`
  - `collection-repos`
  - `collection-issues`
  - `stargazer-history`
  - `issue-creator-history`
  - `pr-creator-history`

### 2. Phase 1 读 API 主链路可用

当前实现已具备以下可访问能力：

- `feed` 列表
- `question-pressure` 列表
- `question cluster` 详情
- `evidence drilldown`
- `healthz/readyz`

接口响应中也确实包含：

- `freshnessMinutes`
- `fallbackUsed`
- `sourceStatus`
- `confidenceScore`
- `evidenceCount`

### 3. 数据入库与缓存链路可用

当前已确认：

- source payload 可落 `source_runs` 与 `raw_snapshots`
- normalized items 可落 `items`
- derived clusters / signals / evidence 可查询
- API 查询结果可被 Redis 缓存

## 关键缺口与修复优先级

以下问题是本次审查认为最关键、最值得优先修复的部分。

### P0: 采集失败不是 source 级降级，而是整轮失败

现象：

- 真实执行 `collectLiveSourcePayloads()` 时，曾因 `opencli hackernews ask --limit 5 -f json` 超时导致整轮采集失败
- 当前 collector 是顺序执行，只要一个 command 抛错，整个函数直接失败

影响：

- 不满足 Phase 0 对 `source_health` 的验收要求
- 无法做到“部分成功、部分失败”的稳定运行
- worker 一旦碰到单源抖动，就无法产出其他源的可用数据

相关代码：

- `packages/sources/src/collectors/index.ts:109`
- `apps/worker/src/services/pipeline.ts:15`

建议：

- collector 改为 per-command / per-source 捕获错误
- 把成功 payload 与失败状态分开返回
- 在 `source_health` 中真实写入：
  - `status`
  - `last_success_at`
  - `last_error_at`
  - `last_error_text`
  - `fallback_used`
  - `last_latency_ms`

### P0: `fallback_used` 目前基本是占位字段

现象：

- API `meta.fallbackUsed` 固定返回 `false`
- cluster 初始值 `fallbackUsed` 固定为 `false`
- 只有 score 阶段会从 `rawMeta.fallbackUsed` 读值，但目前没有真实生产者写入该字段

影响：

- 虽然接口 schema 满足文档，但字段没有真实业务含义
- 不满足 v4 方案中“失败回退 last success”的可观测要求

相关代码：

- `apps/api/src/routes/index.ts:19`
- `packages/domain/src/questions/cluster.ts:297`
- `packages/domain/src/scoring/question-pressure.ts:114`

建议：

- 定义真实 fallback 策略
- source collector 失败时优先读取上一次可用 raw snapshot
- 把 fallback 状态向下游传到 item / cluster / API meta

### P1: evidence traceability 不完整

现象：

- `item_sources` 表中存在记录
- 但 `source_run_id` 和 `snapshot_id` 都没有被写入
- 实测：
  - `item_sources = 83`
  - `linked_source_runs = 0`
  - `linked_snapshots = 0`

影响：

- evidence drilldown 无法追溯到具体采集批次和 raw snapshot
- “可追溯证据链”在数据库层没有闭环

相关代码：

- `packages/db/src/repository.ts:394`

建议：

- 在 `recordCollectionArtifacts()` 之后返回 `sourceRunId / snapshotId`
- `upsertFeedItems()` 写 `item_sources` 时关联这两个 id

### P1: 真实数据下没有形成跨源聚类

现象：

- 真实样本入库后：
  - `signals = 22`
  - `max_evidence_count = 1`
  - `avg_evidence_count = 1.00`
  - `multi_source_clusters = 0`

影响：

- 虽然达到了“至少 20 个 clusters”
- 但没有达到“问题压缩 + 跨源证据聚合”的核心目标
- 当前真实结果更接近“questionish item 排行”，而不是高质量 pressure cluster

相关代码：

- `packages/domain/src/questions/extract.ts:59`
- `packages/domain/src/questions/cluster.ts:207`
- `packages/domain/src/scoring/question-pressure.ts:57`

建议：

- 调整 question extraction，减少“非问题型文章”进入聚类
- 调整 cluster anchor，允许更稳健的 cross-source merge
- 增强 canonicalization，减少标题变体带来的裂变

### P1: question extraction 对真实源仍有较多噪音

现象：

- `hackernews ask` 的真实结果里混入 `Tell HN`
- 当前 normalizer 会因为 `commandName === "ask"` 直接把它们全部标成 `isQuestion = true`
- 结果中出现：
  - `Tell HN: An app is silently installing itself on my iPhone every day`
  - `Tell HN: One Medical Is a Nightmare`

影响：

- HN ask 源会向 pressure pipeline 注入明显非问句噪音
- question pressure 排名会被讨论帖、讲述帖污染

相关代码：

- `packages/sources/src/normalizers/index.ts:83`
- `packages/domain/src/questions/extract.ts:64`

建议：

- `ask` 源不要直接无条件视作问题
- 对 HN title 加更细粒度规则：
  - `Ask HN:` 正向加分
  - `Tell HN:` 不作为问题，除非标题语义本身是疑问句

### P1: DEV tags 在真实数据中丢失

现象：

- 真实 DEV 返回的 `tags` 是逗号分隔字符串
- 当前 normalizer 只接受数组，导致入库后 `tags = {}`

影响：

- topic/entity 匹配损失一条重要结构化特征
- 会直接降低 `postgres`、`ai`、`database` 等 topic 命中率

相关代码：

- `packages/sources/src/normalizers/index.ts:107`

建议：

- 兼容 `string | string[]`
- 对字符串场景执行 split + trim

### P1: `publishedAt` 不是内容真实发布时间

现象：

- Stack Overflow 与 Hacker News normalizer 直接使用 `new Date().toISOString()`
- 实际上保存的是采集时间，不是内容发布时间

影响：

- `freshnessMinutes`
- `noveltyLabel`
- 聚类时间窗口
- 长尾 / 新 spike 判断

这些都被采集时间污染。

相关代码：

- `packages/sources/src/normalizers/index.ts:54`
- `packages/sources/src/normalizers/index.ts:80`
- `packages/domain/src/questions/extract.ts:82`
- `packages/domain/src/questions/cluster.ts:101`

建议：

- 优先从 source 原始字段提取真实发布时间
- 如果 adapter 不提供，再显式标注 “collectedAt fallback”
- 下游 freshness / novelty 计算要区分 `publishedAt` 与 `collectedAt`

## 与 Phase 0 / Phase 1 验收对照

### 已满足或基本满足

- P0 命令 help / sample audit 已能跑通
- P0 允许源中，当前主链路已覆盖：
  - Stack Overflow
  - Hacker News
  - DEV
  - OSSInsight
- 已有：
  - `raw_snapshots`
  - `source_runs`
  - `items`
  - `source_health`
- 已实现：
  - `/feed`
  - `/signals/question-pressure`
  - `/question-clusters/{id}`
  - `/question-clusters/{id}/evidence`
- API meta 中已有必需字段
- 真实环境可生成 `20+` question clusters

### 尚未真正满足

- “每个失败源都能记录 error / last_success / fallback_used”
- “last success fallback” 的真实运行语义
- “每个 cluster 至少 3 条 evidence” 的真实质量目标
- “跨源问题压缩” 的真实效果
- “证据可追溯到具体 run / snapshot” 的数据链完整性

## 推荐修复顺序

建议下一轮严格按下面顺序推进：

1. 先修 source failure / fallback / source_health 真实状态
2. 再补 item_sources 到 source_runs / raw_snapshots 的追踪链
3. 修真实 normalizer 偏差：
   - DEV tags string
   - HN ask / Tell HN
   - source timestamp
4. 用真实样本重跑 pipeline，复核：
   - cluster 数量
   - multi-source cluster 数量
   - `evidence_count >= 3` 的 cluster 数量
5. 再调 question extraction / clustering / scoring 规则

## 下次修复后的回归清单

下次开发修复完成后，建议至少重复执行以下检查：

```bash
pnpm lint
pnpm test
pnpm db:migrate
pnpm audit:contracts
```

并补做这组真实验证：

1. 跑一轮真实 contract audit
2. 把真实样本重新灌入数据库
3. 检查：
   - `source_health` 是否包含失败与 fallback 状态
   - `item_sources` 是否关联 `source_runs/raw_snapshots`
   - `multi_source_clusters` 是否大于 `0`
   - `max_evidence_count` 是否达到 `3+`
4. 重新实测：
   - `/feed`
   - `/signals/question-pressure`
   - `/question-clusters/:id`
   - `/question-clusters/:id/evidence`
5. 抽样检查至少 10 条 cluster，确认不是单源噪音列表

## 本次审查最终判断

当前项目更适合定义为：

```text
Phase 0 / Phase 1 的工程骨架已完成，真实环境质量验收未完成。
```

对后续开发最有价值的方向，不是继续扩功能，而是先把：

- source stability
- fallback semantics
- evidence traceability
- real-source normalization
- cross-source cluster quality

这五件事补实。
