# apps/web（只读控制台）

## 职责

- 提供 Phase 0 + Phase 1 只读 API 的可视化与调试入口
- 覆盖 `问题压力 -> 聚类 -> 证据 drilldown` 的浏览路径
- 提供 `Feed` 与 `Health/Ready` 的辅助页面用于排障与数据校验

## 边界与禁止项

- 不实现鉴权、账号体系、RBAC、API keys、计费/配额
- 不实现写入型业务能力（包括 watchlist CRUD 与任何管理后台写操作）
- 仅消费现有只读端点：`/healthz`、`/readyz`、`/feed`、`/signals/question-pressure`、`/question-clusters/:id`、`/question-clusters/:id/evidence`
