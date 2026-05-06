# DevTrend Cloud

DevTrend Cloud 是一个后端优先的开发者情报管道，用于把分散的开发者信号压缩成可行动、可追溯的 `question pressure`、`topic layer` 与后续 `insight` 资产。

截至 2026-05-05，仓库当前已实现的是 `Phase 0 + Phase 1` 主链路：

- public source collect + contract audit
- normalized items
- topic/entity matching
- question clustering + question pressure
- evidence drilldown
- read-only API
- lightweight web console

当前最新规划事实源是 [devtrend-cloud-practical-plan-2026-05-05-v5.md](./docs/plan/devtrend-cloud-practical-plan-2026-05-05-v5.md)。

下一阶段的优先级不是 `watchlist / digest / webhook`，而是：

```text
统一模型 -> embedding -> topic clustering -> LLM topic naming -> topic persistence -> hierarchical taxonomy
```

## 导航

- 顶层架构地图： [architecture.md](./architecture.md)
- 开发与运行： [development.md](./docs/development.md)
- API 路由与响应： [api.md](./docs/api.md)
- Agent 执行入口与路由： [AGENTS.md](./AGENTS.md)
- 最新开发计划： [devtrend-cloud-practical-plan-2026-05-05-v5.md](./docs/plan/devtrend-cloud-practical-plan-2026-05-05-v5.md)
