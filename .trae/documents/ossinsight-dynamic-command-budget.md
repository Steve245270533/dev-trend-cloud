# OSSInsight 动态命令预算（dynamic command budget）修复计划

## Summary

本次改动的目标是：在 OSSInsight 的动态扩展任务（`collection-*`）上恢复“按 source 维度的总预算”语义，确保 `QueryBudget.maxDynamicCommandsPerSource` 对 OSSInsight 的所有动态扩展命令生效，而不是对每个动态模板（`template.name`）分别生效。

交付物包括：
- 修复 `packages/sources` 中 OSSInsight adapter 的动态任务生成逻辑：全局预算、按 topic 优先分配（用户已确认）。
- 补齐/强化测试：显式验证 OSSInsight 的动态任务数量不会超过 `maxDynamicCommandsPerSource`，避免回归。
- 对当前未提交改动做一次风险复核（在执行阶段用 `git diff` 精准对照），确保没有其他预算/路由/任务 key 行为变化被遗漏。

## Current State Analysis

### 代码现状（已从仓库检索核实）

- `QueryBudget` 里 `maxDynamicCommandsPerSource` 的语义在其他 source adapter（Stack Overflow / DEV.to / Hacker News）中体现为“单 source、单计数器”的动态扩展上限：
  - [stackoverflow.ts](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/src/adapters/stackoverflow.ts)
  - [devto.ts](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/src/adapters/devto.ts)
  - [hackernews.ts](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/src/adapters/hackernews.ts)

- OSSInsight adapter 当前的实现是用 `Map<string, number>` 以 `template.name` 为 key 来计数：
  - [ossinsight.ts:L104-L156](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/src/adapters/ossinsight.ts#L104-L156)
  - 这会导致每个 `collection-*` 动态模板各自拥有一份 `maxDynamicCommandsPerSource` 配额。
  - 在 `collection-repos / collection-issues / collection-prs / collection-stars` 四个模板同时存在时，单次 run 可生成的 OSSInsight 动态任务上限会膨胀为“模板数 × budget”（当 topic 数足够多时尤为明显）。

### Code Review 意见合理性核实

该审查意见是合理且重要的：
- 目前的 `Map<string, number>` 按模板分桶计数，确实把原先“source 级别的总预算”变成了“模板级别的预算”，属于语义回退/行为变化。
- 该变化会实质性增加 OSSInsight 的动态命令入队数量，从而增加整体运行时间和上游（OSSInsight / OpenCLI）压力。
- 现有测试用例只验证“存在某个 OSSInsight 动态 payload”，并未断言“OSSInsight 动态 payload 总数受 budget 约束”，因此无法捕获该回归：
  - [collectors.test.ts:L231-L292](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/test/packages/sources/collectors.test.ts#L231-L292)

## Risks Identified（未修复前的风险点）

- **预算语义偏移**：OSSInsight 的动态扩展预算按模板拆分，导致 run-time 和上游压力上升。
- **隐式行为变化未被测试锁定**：测试未覆盖“OSSInsight 动态扩展总量受限”，容易再次回归。
- **分配顺序偏置**：当前代码外层模板、内层 topic；在实施全局预算后，顺序会决定“哪些模板/哪些 topic 获得额度”。用户已确认采用“按 topic 优先”的顺序，以更均衡地为高分 topic 产出 4 类 adoption 指标。

## Proposed Changes

### 1) 修复 OSSInsight 动态预算为 source 级别总预算

- 文件： [ossinsight.ts](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/src/adapters/ossinsight.ts)
- 变更点：`buildDynamicTasks()`
- 做法：
  - 移除 `Map<string, number>`（按模板计数）。
  - 引入单一的 `dynamicCount`，表示 OSSInsight source 的动态扩展命令总数。
  - 按用户确认的顺序重排循环：外层遍历 `topics`，内层遍历 `templates`。
  - 每 push 1 个 task，`dynamicCount += 1`；当达到 `context.queryBudget.maxDynamicCommandsPerSource` 时立即停止并返回已构建的 tasks。
- 预期行为：
  - 任意情况下，OSSInsight 的动态扩展任务总数 `<= maxDynamicCommandsPerSource`。
  - 在 budget 足够时，单个 topic 会尽量拿到四个 `collection-*` 指标；budget 不足时，高分 topic 优先。

### 2) 强化测试：显式锁定 OSSInsight 动态任务的预算上限

- 文件： [collectors.test.ts](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/test/packages/sources/collectors.test.ts)
- 变更点：`collectLiveSourcePayloads expands runtime topics into source-specific commands`
- 做法：
  - 在现有断言基础上，增加对 `payloads` 的统计：
    - 过滤 `payload.source === "ossinsight"` 且 `payload.commandName` 为 `collection-*` 的 payload。
    - 断言其数量 `<= queryBudget.maxDynamicCommandsPerSource`。
  - 对当前用例（`maxDynamicCommandsPerSource: 4` 且仅 1 个带 `collectionId` 的 topic），进一步断言：
    - 该数量应为 4，并包含 `collection-repos/issues/prs/stars` 四个命令（确保“按 topic 优先 + 模板全覆盖”的期望被固定）。
  - 视情况补充一个小用例（若现有用例不足以覆盖边界）：
    - 2 个 topic、budget=4，断言仅第一个 topic 产生 4 个 dynamic payload，第二个 topic 不产生（验证 budget 用尽即停止）。

### 3) 执行阶段对“所有未提交改动”做差异复核

由于当前处于 Plan Mode，无法直接运行 `git diff`。在用户确认计划后进入执行阶段，将补做：
- `git status` / `git diff` 逐文件复核未提交变更。
- 重点检查是否存在其他“无意的预算语义变化 / taskKey 或 breakerKey 变化 / registry 定义变化”。
- 如发现与本计划无关但存在风险的变更，将在不引入新需求的前提下做最小修复，并把风险与修复点记录到最终交付说明中。

## Assumptions & Decisions

- 预算语义：`maxDynamicCommandsPerSource` 对“单 source 的所有动态扩展命令总量”生效（与其他 adapters 一致）。
- 分配顺序：按 topic 优先（外层 topic、内层模板），用户已明确选择。
- 不调整默认 budget 数值（仍由 [DEFAULT_QUERY_BUDGET](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/src/adapters/shared.ts#L15-L19) 控制）。
- 本次仅修复动态扩展预算，不改变 OSSInsight 静态任务集合与 runtime topic discovery 行为。

## Verification Steps（执行阶段）

在实现后执行以下验证，确保无回归：
- 运行类型检查：`pnpm typecheck`
- 运行单测：`pnpm test`
- 运行 lint：`pnpm lint`
- 如本仓库已有 contract audit 流程需要保持稳定，可额外运行：`pnpm audit:contracts`（重点关注 OSSInsight 的动态任务生成与审计产物是否符合预算预期）

