# 接口

本文件描述当前已实现的只读 API，以及已经进入规划但尚未实现的 topic / insight 接口方向。更多上下文见 [architecture.md](../architecture.md) 与 [devtrend-cloud-practical-plan-2026-05-05-v5.md](./plan/devtrend-cloud-practical-plan-2026-05-05-v5.md)。

## 当前已实现路由

- `GET /healthz`
- `GET /readyz`
- `GET /feed`
- `GET /signals/question-pressure`
- `GET /question-clusters/:clusterId`
- `GET /question-clusters/:clusterId/evidence`

## 当前响应形状

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

## 时间字段语义

- `publishedAt`：内容源站可解析出的真实发布时间；若源站不给时间，则回退到采集时间。
- `collectedAt`：系统拿到该条内容的时间，始终表示本轮或回退快照的采集时间。
- `timestampOrigin`：`source` 表示 `publishedAt` 来自源站，`collected` 表示 `publishedAt` 是回退值。

## 规划中接口（尚未实现）

以下接口方向已经进入规划，但当前仓库尚未上线；它们的目标是让 API 从“数据访问层”逐步演进到“主题层 / 决策层”。

### Phase 2：Topic Layer 只读接口方向

- `GET /topics`
- `GET /topics/:topicId`
- `GET /topics/:topicId/evidence`

预期职责：

- 返回动态 topic clusters 与标准化 topic 资产
- 展示 source mix、related repos、related entities、representative evidence
- 为后续 insight 层和 web 页面提供统一 topic read model

### Phase 3：Insight / 决策接口方向

- `GET /insights/topic-emerging`
- `GET /insights/topic-cross-source`
- `GET /topics/:topicId/adoption-evidence`
- `GET /entities/:entityId/insight-summary`

这些接口目前是 roadmap，不应被写成当前已实现能力。

### 更后续阶段：订阅与交付接口方向

- `POST /watchlists`
- `GET /watchlists`
- `GET /watchlists/:id`
- `GET /watchlists/:id/digest`
- `POST /watchlists/:id/webhooks`
- `POST /webhooks/test`

这些接口明确不是当前优先级；在 Topic Layer 与 Insight Layer 形成稳定语义资产之前，不应优先产品化。
