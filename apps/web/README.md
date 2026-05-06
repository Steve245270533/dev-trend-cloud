# apps/web

该 workspace 提供当前已实现只读 API 的轻量控制台（可视化与调试入口），用于浏览 `question pressure`、`cluster detail`、`evidence drilldown`、`feed` 与 `health`。

它已经是当前仓库的一部分，但仍不是完整 analyst console。

## 当前页面

- 问题压力：`/signals/question-pressure`
- 聚类详情：`/question-clusters/:id` + `/question-clusters/:id/evidence`
- Feed 浏览：`/feed`
- 健康状态：`/healthz`、`/readyz` + `meta.sourceStatus`

## 下一阶段规划

后续会在 Topic Layer 落地后，优先补充：

- topic 列表页
- topic 详情页
- topic evidence 浏览
- emerging topic / insight 浏览

这些能力属于下一阶段规划，不代表当前已经实现。

## 本地开发

启动 API：

```bash
pnpm dev:api
```

启动 Web：

```bash
pnpm --filter @devtrend/web dev
```

默认通过 Vite proxy 访问 API（`/api/*` -> `http://localhost:3000/*`）。如需自定义，设置 `VITE_API_BASE_URL`（默认 `/api`）。
