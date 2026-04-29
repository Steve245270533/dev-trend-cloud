# Phase 1 Follow-ups (2026-04-29)

本文件记录本次未纳入修复范围的两个 P2 问题，作为下一轮 Phase 1 质量收敛的 backlog。

## P2-1: substring keyword matching 污染 topic classification

### 问题描述

当前 `packages/domain/src/matching/matcher.ts` 使用 substring 匹配 catalog 关键词。短关键词会命中无关单词，导致 topic 误标。

### 已复现证据

- `TypeScript` topic 当前包含短关键词 `ts`
- 在 seeded API 响应中，问题 `Why does vector similarity search return unstable results in pgvector?`
  被错误标记为 `typescript`
- 误标来源是 `results` 中包含连续子串 `ts`

### 当前影响范围

- `/feed` 的 topic 过滤结果不可信
- `question_clusters.affected_topics` 会带入噪声
- `signals/question-pressure` 的 topic 维度分析会被污染
- 后续 watchlist 规则如果按 topic 过滤，也会继承这个误差

### 下次修复建议

- 将 keyword matching 改成 token-aware 或 word-boundary aware 匹配
- 对长度过短的关键词建立更严格规则，例如最少 3 个字符或白名单策略
- 为易误伤关键词补回归测试，至少覆盖 `ts`、`ai`、`db` 这类短 token

## P2-2: cluster key 过严导致 evidence density 长期不足

### 问题描述

当前 `packages/domain/src/questions/cluster.ts` 的 cluster key 同时绑定：

- 完整 matched entity 组合
- 完整 matched topic 组合
- 截断标题 signature

这会让跨源、近似重复的问题很难被聚合到同一个 cluster。

### 已复现证据

- seed 后数据库中：
  - `question_clusters = 10`
  - `signals = 10`
  - `signal_evidence = 10`
- 结果是每个 cluster 平均只有 1 条 evidence
- 这不满足 Phase 1 对 evidence density 的预期，也让 `cross_source_mentions` 难以形成

### 当前影响范围

- `confidence_score` 容易偏乐观但缺少证据密度支撑
- `question_pressure` 难以体现“重复出现的问题压力”
- 后续 digest / watchlist 如果依赖 cluster 结果，会收到过度碎片化的信号

### 下次修复建议

- 放宽 cluster key，避免把完整 topic/entity 集合作为硬分桶条件
- 引入标题标准化后的更宽松近似匹配，再用 topic/entity overlap 做加权而不是硬隔离
- 增加跨源重复样本测试，至少覆盖 Stack Overflow + Hacker News 的同题异写场景
- 将“evidence < 3 时强制降置信度”写成显式规则并补测试
