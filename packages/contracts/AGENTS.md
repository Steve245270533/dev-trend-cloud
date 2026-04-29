# packages/contracts（共享契约）

## 职责

- 维护跨包共享的 DTO 与 TypeBox schemas
- 为 Fastify 与 domain 层提供稳定的数据形状边界

## 边界与禁止项

- 只放“数据形状”，不放业务决策与 IO 逻辑
- 变更 schema 必须同步更新对应测试与 API 文档

## 关键入口

- 合同入口： [index.ts](./src/index.ts)
