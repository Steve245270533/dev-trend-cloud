# S2 Embedding Pipeline MVP Spec

## Why
当前仓库已完成统一内容模型（S1），但尚未具备可持续生产向量数据的能力，导致后续 S3 Topic Clustering 缺少稳定输入。本阶段需要补齐可重算、可追踪、可降级的 embedding 管道，并保证不破坏现有 question pressure 主链路。

## What Changes
- 新增 embedding record 数据对象，承载 provider、model、schema 版本、输入指纹、向量与状态信息。
- 新增 worker embedding 增量任务与 backfill 任务，支持定时增量与手动回填。
- 新增 embedding 输入拼装规则（domain 层），统一文本构造并明确排除字段。
- 新增 pgvector 存储与索引策略，支持后续 S3 向量查询。
- 新增基于 `source + content fingerprint + model` 的去重与幂等写入策略。
- 新增重算触发策略：内容变化、输入 schema 版本变化、模型版本变化。
- 新增 provider 失败降级路径，确保 embedding 不可用时不影响现有采集与 question pressure 输出。

## Impact
- Affected specs: unified-content-read-model, worker-pipeline-orchestration, embedding-persistence-foundation
- Affected code:
  - `packages/config/src/index.ts`
  - `packages/contracts/src/index.ts`
  - `packages/db/migrations/*`（预期新增 `004_*embedding*.sql`）
  - `packages/db/src/repository.ts`
  - `packages/domain/src/*`（新增 embedding input builder / guards）
  - `apps/worker/src/jobs/definitions.ts`
  - `apps/worker/src/services/pipeline.ts`
  - `test/packages/domain/*`
  - `test/packages/db/*`
  - `test/apps/worker/*`

## ADDED Requirements
### Requirement: Embedding Provider 与模型配置化
系统 SHALL 通过配置项声明 embedding provider、model、维度与超时参数，并允许在不改业务代码的情况下切换 provider/model。

#### Scenario: 使用 Ollama 作为默认 provider
- **WHEN** worker 启动并加载配置
- **THEN** 可以读取本地 Ollama embedding 配置（如 base URL、model `nomic-embed-text-v2-moe`、timeout）
- **AND** 配置缺失时使用安全默认值或显式失败（仅 embedding 任务失败，不拖垮主 pipeline）

### Requirement: Embedding 输入拼装与字段排除
系统 SHALL 在 domain 层实现 deterministic 的 embedding 输入拼装器，统一使用可公开文本字段，并明确禁止将不稳定或敏感字段作为 embedding 输入。

#### Scenario: 构造统一输入文本
- **WHEN** 给定一条 unified content record
- **THEN** 输入拼装器按固定顺序组合 `title/summary/bodyExcerpt/tags/source`
- **AND** 不包含 `rawMeta`、运行时状态字段、UUID、来源追踪字段（如 legacy refs）

### Requirement: Embedding Record 持久化与幂等
系统 SHALL 在数据库中持久化 embedding 记录，支持幂等 upsert、状态追踪与向量索引。

#### Scenario: 同一内容重复入队
- **WHEN** 相同 `source + fingerprint + model + inputSchemaVersion` 的任务重复执行
- **THEN** 系统只保留一条有效 embedding 记录（更新 `updated_at` 或状态），不产生重复向量

### Requirement: 增量任务、回填任务与重算策略
系统 SHALL 支持 embedding 增量生成与历史回填，并按规则触发重算。

#### Scenario: 内容更新触发重算
- **WHEN** unified content 的 `fingerprint` 变化
- **THEN** 标记旧 embedding 为 superseded（或非 active）并生成新 embedding

#### Scenario: 模型版本变化触发重算
- **WHEN** 配置中的 model 或 model_version 变化
- **THEN** 系统允许按批次回填新 embedding，并可查询重算进度

### Requirement: Provider 失败降级与可观测性
系统 SHALL 在 provider 不可用、超时或返回异常时记录失败状态并降级，不影响 question pressure 主链路。

#### Scenario: Ollama 不可用
- **WHEN** embedding provider 请求超时或连接失败
- **THEN** embedding 任务记为 failed 并记录错误信息与重试次数
- **AND** collect/normalize/match/cluster/score 既有链路继续运行

## MODIFIED Requirements
### Requirement: Worker Pipeline 编排顺序扩展
系统 SHALL 在现有 `collect -> normalize -> match -> cluster -> score` 链路旁路增加 embedding 任务编排，不改变现有 question pressure 对外读取契约。

## REMOVED Requirements
### Requirement: 无
**Reason**: 本阶段只新增 embedding 能力，不移除现有功能要求。
**Migration**: 不适用。
