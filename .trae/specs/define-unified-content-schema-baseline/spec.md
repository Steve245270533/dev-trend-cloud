# S1 统一内容模型与 Feature Schema 基线 Spec

## Why
当前 `items + raw_meta + source-specific normalize` 结构不足以为后续 embedding 与 topic clustering 提供稳定输入。若继续绑定 source-specific payload，会导致跨源不可比、聚类输入不一致，并放大后续 schema 返工风险。

## What Changes
- 定义统一内容记录（unified content record）并约束其字段边界，作为 Topic Layer 的标准输入对象。
- 定义分层的 `source_features` 结构：共享基础 schema + source 扩展字段，保证跨源可比与可扩展。
- 明确 Question Layer 与 Topic Layer 的读取边界：前者继续读取现有问题压力主链路对象，后者读取统一模型对象。
- 为统一模型补齐 contracts、DB migration 草案、repository 读写 helper、normalizer 输出与 worker 写入路径。
- 制定与现有 `items` / `item_sources` 的兼容策略，确保现有 API 与 `question pressure` 无破坏。

## Impact
- Affected specs: `unified-content-record`, `source-feature-schema`, `layer-read-boundary`, `pipeline-backward-compatibility`
- Affected code: `packages/contracts/src/index.ts`、`packages/db/migrations/*`、`packages/db/src/repository.ts`、`packages/domain/src/*`、`packages/sources/src/normalizers/*`、`apps/worker/src/services/pipeline.ts`、`apps/worker/src/jobs/definitions.ts`

## 关键决策
- unified content record 采用“新增统一模型表并保持与 `items` 的映射关系”，不在本阶段直接替换 `items` 主链路。
- `source_features` 采用“共享基础字段 + 按 source 命名空间扩展”的分层策略，避免 source-specific 字段污染通用层。
- Question Layer 继续读取现有对象（保证不回归），Topic Layer 从新增统一模型读取（为 S2 做准备）。
- 通过双写或旁路写入策略让 worker 产出统一模型，同时保持现有 API 行为不变。

## ADDED Requirements
### Requirement: 统一内容记录基线
系统 SHALL 为 HN / SO / DEVTO / OSSInsight proxy 输入提供统一内容记录，并保证字段语义一致。

#### Scenario: 跨源标准化成功
- **WHEN** worker 接收任一支持数据源的标准化输出
- **THEN** 系统产出包含共享字段（内容主体、来源、时间、证据引用、指纹）的统一记录并持久化

### Requirement: 分层 Feature Schema
系统 SHALL 提供共享 feature schema，并允许按 source 增量扩展，且扩展不影响共享字段可读性与校验。

#### Scenario: source 扩展字段写入
- **WHEN** normalizer 产出 source-specific features
- **THEN** repository 按 source 命名空间持久化扩展字段，并通过共享 schema 校验基础字段

### Requirement: Layer 读取边界
系统 SHALL 明确 Question Layer 与 Topic Layer 的读取对象，避免相互耦合导致回归。

#### Scenario: 旧链路保持稳定
- **WHEN** 现有 question pressure 读取流程执行
- **THEN** 结果与接口行为保持兼容，不依赖新 Topic Layer 对象

### Requirement: 向后兼容与迁移策略
系统 SHALL 提供统一模型与现有 `items/item_sources` 的兼容映射与迁移说明，支持 S2 增量演进。

兼容策略明细见：`compatibility-strategy.md`（字段映射、双写边界、回滚路径）。

#### Scenario: 新旧模型并存
- **WHEN** migration 与 worker 写入路径启用
- **THEN** 新模型可被写入与查询，同时现有 API/查询不发生破坏性变化

## MODIFIED Requirements
### Requirement: 采集与标准化输出契约
标准化输出从“仅面向现有 `items` 入库”修改为“同时支持统一内容模型入库的可扩展契约”，并保持当前问题层消费字段可用。

## REMOVED Requirements
### Requirement: 无
**Reason**: 本阶段仅做基线扩展，不移除既有能力。  
**Migration**: 不涉及移除迁移，仅要求兼容映射与回滚路径。
