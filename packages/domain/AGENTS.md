# packages/domain（确定性信号逻辑）

## 职责

- topic/entity 匹配（seed catalog + 规则）
- 从归一化 items 抽取问题
- 问题聚类（rule-first：token overlap + `pg_trgm` + topic/entity + 时间窗口）
- question pressure 评分与标签

## 边界与禁止项

- 决策必须确定性与可测试，避免“仅靠 LLM”
- 不做 IO（网络/DB/队列）；只处理输入输出数据结构
- 聚类不以 `pgvector` 作为主依赖（可启用但不是第一路径）

## 关键入口

- Domain 导出入口： [index.ts](./src/index.ts)
- 匹配： [matcher.ts](./src/matching/matcher.ts)
- 抽取： [extract.ts](./src/questions/extract.ts)
- 聚类： [cluster.ts](./src/questions/cluster.ts)
- 评分： [question-pressure.ts](./src/scoring/question-pressure.ts)

## 验证方式

- Domain 测试： [index.test.ts](../../test/packages/domain/index.test.ts)
