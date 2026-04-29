# 接口

本文件描述 Phase 0 + Phase 1 的只读 API 路由与响应形状。更多上下文见 [architecture.md](../architecture.md)。

## 路由

- `GET /healthz`
- `GET /readyz`
- `GET /feed`
- `GET /signals/question-pressure`
- `GET /question-clusters/:clusterId`
- `GET /question-clusters/:clusterId/evidence`

## 响应形状

所有只读端点返回统一 envelope：

```json
{
  "data": [],
  "meta": {
    "generatedAt": "2026-04-29T00:00:00.000Z",
    "freshnessMinutes": 15,
    "fallbackUsed": false,
    "sourceStatus": {
      "stackoverflow": {
        "status": "healthy",
        "lastSuccessAt": "2026-04-29T00:00:00.000Z"
      }
    }
  }
}
```

`/signals/question-pressure` 的 items 包含：

- `clusterId`
- `canonicalQuestion`
- `pressureScore`
- `unresolvedVolume`
- `growthLabel`
- `affectedTopics`
- `affectedEntities`
- `relatedRepos`
- `sourceDistribution`
- `evidenceCount`
- `recommendedAction`
- `confidenceScore`
- `freshnessMinutes`
- `fallbackUsed`
