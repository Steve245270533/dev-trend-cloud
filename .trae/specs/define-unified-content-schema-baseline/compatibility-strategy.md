# Compatibility Strategy: `items/item_sources` -> Unified Model

## 目标

- 在不破坏现有 `question pressure` 与只读 API 行为的前提下，引入 `unified content record` 与 `source_features`。
- 允许 S1 阶段新旧模型并存，后续阶段按能力逐步切流。

## 读取边界

- Question Layer: 继续读取现有 `NormalizedItem` / `items` 主链路对象，不依赖 unified model。
- Topic Layer: 新增能力统一读取 `UnifiedContentRecord`，不直接消费 source-specific payload。

## 字段映射（S1 基线）

| Unified 字段 | 现有字段来源 | 映射规则 |
| --- | --- | --- |
| `canonicalId` | `items.source + items.source_item_id` | 以 source 维度保证稳定唯一；后续可升级为哈希/去重键 |
| `source` | `items.source` | 直接映射 |
| `sourceItemId` | `items.source_item_id` | 直接映射 |
| `title` / `summary` / `url` | `items.title` / `items.summary` / `items.url` | 直接映射 |
| `bodyExcerpt` | `items.raw_meta` | 若存在 `body` 或 `excerpt` 则裁剪生成；缺失时为空 |
| `author` | `items.author` | 直接映射 |
| `publishedAt` / `collectedAt` | `items.published_at` / `items.collected_at` | 直接映射 |
| `timestampOrigin` | `items.timestamp_origin` | 直接映射 |
| `tags` | `items.tags` | 直接映射 |
| `sourceFeatures.shared` | `items.score/answer_count/comment_count` | 聚合为跨源共享字段 |
| `sourceFeatures.<source>` | `items.raw_meta` + `item_sources` | 写入来源命名空间扩展字段 |
| `fingerprint` | 规范化标题/摘要/URL | 用于后续去重与回填追踪 |
| `evidenceRefs` | `items.url` + 可选证据 URL | S1 默认至少保留源 URL |
| `legacyRefs.itemId` | `items.id` | 建立反向引用 |
| `legacyRefs.itemSourceId` | `item_sources.id` | 可空；用于双写追踪 |

## 双写策略

- worker 在写入 `items` 后旁路写入 unified model（失败不影响现有主链路写入）。
- 统一模型写入失败会记录错误并标记重试，不触发清空旧数据。
- 读路径保持旧逻辑，避免在 S1 引入行为变更。

## 回滚策略

- 关闭 unified model 写入开关后，系统立即回退到仅 `items/item_sources` 路径。
- unified 表数据保留，便于后续重新启用与补写，不执行破坏性删除。
- 对外 API 响应保持兼容，无需客户端改造。
