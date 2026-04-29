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
    "fallbackUsed": true,
    "sourceStatus": {
      "stackoverflow": {
        "status": "healthy",
        "lastSuccessAt": "2026-04-29T00:00:00.000Z",
        "lastErrorAt": null,
        "lastErrorText": null,
        "fallbackUsed": false,
        "lastLatencyMs": 120
      },
      "devto": {
        "status": "degraded",
        "lastSuccessAt": "2026-04-29T00:00:00.000Z",
        "lastErrorAt": "2026-04-29T00:10:00.000Z",
        "lastErrorText": "timeout",
        "fallbackUsed": true,
        "lastLatencyMs": 5000
      }
    }
  }
}
```

`/feed` 的 items 额外包含：

- `publishedAt`
- `collectedAt`
- `timestampOrigin`

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

`/question-clusters/:clusterId/evidence` 的 items 包含：

- `itemId`
- `source`
- `title`
- `url`
- `label`
- `score`
- `publishedAt`
- `collectedAt`
- `sourceRunId`
- `snapshotId`

时间字段语义：

- `publishedAt`：内容源站可解析出的真实发布时间；若源站不给时间，则回退到采集时间。
- `collectedAt`：系统拿到该条内容的时间，始终表示本轮或回退快照的采集时间。
- `timestampOrigin`：`source` 表示 `publishedAt` 来自源站，`collected` 表示 `publishedAt` 是回退值。
