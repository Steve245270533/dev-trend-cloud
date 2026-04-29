# apps/api（Fastify 只读 API）

## 职责

- 提供 Phase 0 + Phase 1 的只读 HTTP API（Fastify）
- 组合 `packages/*` 的能力：读取 Postgres、使用 Redis 缓存、返回结构化响应
- 提供健康检查与就绪检查

## 边界与禁止项

- 不实现鉴权、API keys、RBAC
- 不实现写入型业务 API（包括 watchlist CRUD）
- 不在此包内放 domain 决策逻辑（匹配/聚类/评分归 `packages/domain`）

## 关键入口

- 启动入口： [server.ts](./src/server.ts)
- 应用装配： [app.ts](./src/app.ts)
- 路由入口： [routes/index.ts](./src/routes/index.ts)
- 插件集合： [plugins/app-plugins.ts](./src/plugins/app-plugins.ts)

## 数据与契约

- DTO/Schema：`packages/contracts`
- DB 访问：`packages/db`

## 验证方式

- 只读路由集成测试（Fastify `inject()`）： [api.test.ts](../../test/apps/api/api.test.ts)
