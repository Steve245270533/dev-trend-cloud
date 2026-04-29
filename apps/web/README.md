# apps/web

该 workspace 提供 Phase 0 + Phase 1 只读 API 的轻量控制台（可视化与调试入口）。

## 页面

- 问题压力：`/signals/question-pressure`
- 聚类详情：`/question-clusters/:id` + `/question-clusters/:id/evidence`
- Feed 浏览：`/feed`
- 健康状态：`/healthz`、`/readyz` + `meta.sourceStatus`

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
