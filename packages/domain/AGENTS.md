# packages/domain（问题层与主题层的确定性逻辑）

## 职责

- topic/entity 匹配（seed catalog + 规则）
- 从归一化 items 抽取问题
- 问题聚类（rule-first：token overlap + `pg_trgm` + topic/entity + 时间窗口）
- question pressure 评分与标签
- 为下一阶段的 Topic Layer 提供 deterministic guardrails

## 当前已实现

- matching
- question extraction
- question clustering
- question pressure scoring
- embedding-assisted topic clustering guardrails
- topic cluster stable id / representative evidence / runtime topic seed projection
- topic naming parser / validator / deterministic fallback
- taxonomy node merge guardrails（L1/L2/L3）

## 下一阶段目标

- unified content / feature interpretation 规则收口
- topic merge / split 规则回归与调优
- taxonomy 归并规则（L1 / L2 / L3）
- topic label validation 规则

## 边界与禁止项

- 决策必须确定性与可测试，避免“仅靠 LLM”
- 不做 IO（网络/DB/队列）；只处理输入输出数据结构
- embedding 可以辅助召回与聚类，但不应直接替代 deterministic merge 判定
- LLM 不直接裁决最终 `confidence_score`

## 关键入口

- Domain 导出入口： [index.ts](./src/index.ts)
- 匹配： [matcher.ts](./src/matching/matcher.ts)
- 抽取： [extract.ts](./src/questions/extract.ts)
- 问题聚类： [cluster.ts](./src/questions/cluster.ts)
- Topic 聚类： [cluster.ts](./src/topics/cluster.ts)
- 评分： [question-pressure.ts](./src/scoring/question-pressure.ts)

## 验证方式

- Domain 测试： [index.test.ts](../../test/packages/domain/index.test.ts)
- 下一阶段新增 Topic Layer 逻辑时，优先补 deterministic regression tests，而不是只看样例输出
