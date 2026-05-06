# packages/db（数据库层）

## 职责

- 管理 Postgres migrations 与 seed
- 提供 DB client 与 repository helpers（显式 SQL）
- 作为持久化事实源（system of record）
- 为下一阶段的 Topic Layer 数据对象提供持久化承载

## 当前已实现对象

- source runs / raw snapshots
- normalized items / item sources
- topics / entities / matches
- question clusters / signals / signal evidence
- source health
- runtime topic seed runs / runtime topic seeds
- watchlists / watchlist events（当前仍主要用于 seed/demo 语义）
- unified contents（统一模型基线表，与 `items/item_sources` 并存）
- embedding records
- topic clusters
- topic cluster memberships

## 下一阶段规划对象（planned，不代表当前 schema 已存在）

- topic label candidates
- taxonomy nodes（L1 / L2 / L3）
- topic memberships / topic lineage

## 边界与禁止项

- 不引入重 ORM 抽象，优先显式查询与可审计 SQL
- 不把 domain 决策写到 SQL 里（规则归 `packages/domain`，这里只做存取与索引支持）
- 文档中要明确区分“现有 schema”与“planned schema”

## 关键入口

- DB client： [client.ts](./src/client.ts)
- Repository helpers： [repository.ts](./src/repository.ts)
- 迁移执行： [migrate.ts](./src/migrate.ts)
- 种子写入： [seed.ts](./src/seed.ts)
- Migrations： [001_initial.sql](./migrations/001_initial.sql)、[002_runtime_topic_seeds.sql](./migrations/002_runtime_topic_seeds.sql)、[003_unified_content.sql](./migrations/003_unified_content.sql)、[004_embedding_records.sql](./migrations/004_embedding_records.sql)、[005_topic_clusters.sql](./migrations/005_topic_clusters.sql)

## 验证方式

- Repository 测试： [repository.test.ts](../../test/packages/db/repository.test.ts)
- 下一阶段新增 Topic Layer 对象时，必须保证现有 question pressure 读模型不被破坏
