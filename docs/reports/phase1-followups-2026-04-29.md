# Phase 1 Follow-ups (2026-04-29)

本轮已完成先前记录的两个 `P2` 问题修复，并把规则收敛为可测试的确定性实现。

## P2-1: substring keyword matching 污染 topic classification

### 修复结果

- `packages/domain/src/matching/matcher.ts` 已从裸 `substring` 改为 token/phrase aware 匹配。
- 单词关键词长度 `>= 3` 时只允许 whole-token 命中。
- 多词短语要求连续 phrase 命中。
- 长度 `<= 2` 的短关键词只允许在 tags、repo/path、structured metadata 里 exact match，不再参与通用 free-text 命中。

### 回归结论

- `Why does vector similarity search return unstable results in pgvector?`
  不再被错误标记为 `typescript`。
- `typescript`、`swc`、`mcp`、repo-aware entity 匹配仍保持可用。
- 已补回归测试，覆盖 `ts`、`ai`、`db` 等短 token。

## P2-2: cluster key 过严导致 evidence density 长期不足

### 修复结果

- `packages/domain/src/questions/cluster.ts` 已移除“完整 topic/entity 集合 + 标题 signature”的硬分桶。
- 当前聚类改为确定性相似归并：
  - `30` 天时间窗口
  - 标题 exact signature，或 `token Jaccard + trigram Dice` 近似匹配
  - `topic/entity` overlap 作为语义锚点
- `clusterId` 改为基于 cluster fingerprint 稳定生成，不再依赖随机 item UUID。

### 回归结论

- demo fixtures 已补入跨源近似重复样本，pipeline 现在会产出 `3+ evidence`、`2+ sources` 的 cluster。
- `confidence_score` 已加入显式规则：当 `evidence_count < 3` 时，分数上限强制压到 `0.45`。
- 已补跨源聚类与稳定 `clusterId` 回归测试，覆盖 Stack Overflow + Hacker News + DEV 的同题异写场景。
