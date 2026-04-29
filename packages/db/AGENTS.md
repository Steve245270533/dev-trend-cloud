# packages/db（数据库层）

## 职责

- 管理 Postgres migrations 与 seed
- 提供 DB client 与 repository helpers（显式 SQL）
- 作为持久化事实源（system of record）

## 边界与禁止项

- 不引入重 ORM 抽象，优先显式查询与可审计 SQL
- 不把 domain 决策写到 SQL 里（规则归 `packages/domain`，这里只做存取与索引支持）

## 关键入口

- DB client： [client.ts](./src/client.ts)
- Repository helpers： [repository.ts](./src/repository.ts)
- 迁移执行： [migrate.ts](./src/migrate.ts)
- 种子写入： [seed.ts](./src/seed.ts)
- Migrations： [001_initial.sql](./migrations/001_initial.sql)

## 验证方式

- Repository 测试： [repository.test.ts](../../test/packages/db/repository.test.ts)
