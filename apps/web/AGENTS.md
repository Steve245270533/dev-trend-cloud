# apps/web（轻量只读控制台）

## 职责

- 提供当前只读 API 的可视化与调试入口
- 覆盖 `问题压力 -> 聚类 -> 证据 drilldown` 的浏览路径
- 提供 `Feed` 与 `Health/Ready` 的辅助页面用于排障与数据校验
- 为下一阶段的 topic / insight 浏览页预留扩展方向

## 当前已实现

- Question Pressure 页面
- Cluster Detail 页面
- Evidence 浏览组件
- Feed 页面
- Health / Ready 页面

## 下一阶段目标

- Topic 列表与详情页
- Topic evidence 浏览
- Emerging topic / insight 浏览页

## 边界与禁止项

- 不实现鉴权、账号体系、RBAC、API keys、计费/配额
- 不实现写入型业务能力（包括 watchlist CRUD 与任何管理后台写操作）
- 当前仅消费现有只读端点；未来 topic / insight 页面必须建立在已实现只读接口之上
