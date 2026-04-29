# 计划：跨子包 import 统一为包名 + exports 映射

## Summary

在 monorepo 内，禁止通过跨包相对路径直接引用对方 `src/**`（例如 `../../contracts/src/index.js`）。统一改为从包名顶级入口导入（例如 `import type { SourceKey } from "@devtrend/contracts"`），并为各 workspace 包补齐 `package.json#exports` 映射以保证 TypeScript/NodeNext/tsx 能解析。同步把该约束写入开发文档。

本计划按你已确认的决策执行：

- 覆盖范围：`apps/* + packages/* + test/*`
- 运行策略：apps 的 `start` 改为 `tsx` 直接启动 TS 源码；workspace packages 的 `exports` 指向 `./src/index.ts`

## Current State Analysis

### 现状问题

- 仓库内存在多处跨包相对路径引用（典型：`packages/domain`、`packages/db`、`packages/sources`、`apps/api`、`apps/worker`、`test/*`）。
- workspace packages（如 `@devtrend/contracts` 等）当前 `package.json` 未声明 `exports`，导致无法通过 `import "@devtrend/contracts"` 这种包名入口稳定解析；因此代码使用了跨包相对路径绕过。
- `packages/sources` 的顶级入口 `src/index.ts` 未导出 `CollectedSourcePayload` 类型，导致外部只能深/相对导入 `collectors/index.ts`。

### 已定位的跨包相对 import（样例）

- `packages/domain/src/index.ts` → `../../contracts/src/index.js`
- `packages/db/src/repository.ts` → `../../contracts/src/index.js`、`../../domain/src/index.js`、`../../sources/src/collectors/index.js`
- `apps/api/src/app.ts` → `../../../packages/config/src/index.js`
- `apps/worker/src/services/pipeline.ts` → `../../../../packages/*/src/**`
- `test/apps/api/api.test.ts` → `../../../packages/*/src/**`

## Proposed Changes

### 1) 为 workspace packages 增加 exports（禁止深导入）

目标：让 `@devtrend/*` 能以“顶级入口”方式被 TS/NodeNext/tsx 解析，同时通过仅导出 `"."` 来约束深导入。

将修改这些文件：

- [packages/config/package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/config/package.json)
- [packages/contracts/package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/contracts/package.json)
- [packages/db/package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/db/package.json)
- [packages/domain/package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/domain/package.json)
- [packages/sources/package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/package.json)

统一加入（示例结构）：

```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

说明：

- 不新增 subpath exports（如 `./collectors`），强制所有对外可用 API 必须从各包的 `src/index.ts` 统一导出。

### 2) 补齐顶级 index.ts 对外导出（消除必须深导入的类型/函数）

将修改：

- [packages/sources/src/index.ts](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/packages/sources/src/index.ts)

调整点：

- 从 `./collectors/index.js` 额外导出 `CollectedSourcePayload`（以及未来可能需要的其它对外类型），确保外部仅需 `@devtrend/sources`。

### 3) 全局替换跨包相对 import → 包名顶级 import

目标：任何“跨子包”引用都改为 `@devtrend/*` 的顶级导入；保留包内的相对导入（例如 `./matching/matcher.js`）。

范围：

- `apps/*/src/**/*.ts`
- `packages/*/src/**/*.ts`
- `test/**/*.ts`

替换规则（按实际文件场景落地）：

- `.../packages/config/src/index.js` → `@devtrend/config`
- `.../packages/contracts/src/index.js` → `@devtrend/contracts`
- `.../packages/db/src/index.js` → `@devtrend/db`
- `.../packages/domain/src/index.js` → `@devtrend/domain`
- `.../packages/sources/src/index.js` → `@devtrend/sources`
- `.../packages/sources/src/command-registry.js` → `@devtrend/sources`（因 `sourceCommands` 已在顶级导出）
- `.../packages/sources/src/collectors/index.js` → `@devtrend/sources`（依赖第 2 条补齐导出）
- `.../packages/sources/src/normalizers/index.js` → `@devtrend/sources`（依赖顶级已导出 `normalizeCollectedPayloads`）

执行方式：

- 先用 ripgrep 精确列出跨包相对 import 清单（限定 `apps|packages|test`），逐文件替换以避免误伤包内相对路径。
- 替换后再次 grep 确认仓库内不再存在 `../packages/*/src` 或 `../contracts/src` 这类跨包引用。

### 4) apps 的 start 改为 tsx（匹配“exports 指向 TS 源码”的运行策略）

将修改：

- [apps/api/package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/apps/api/package.json)
- [apps/worker/package.json](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/apps/worker/package.json)

调整点：

- `start` 从 `node ../../dist/.../*.js` 改为 `tsx src/server.ts` / `tsx src/worker.ts`
- `dev` 保持 `tsx watch ...` 不变

说明：

- `pnpm build` 仍可保留（用于产物输出/检查），但本阶段“可运行启动方式”以 `tsx` 为准，避免 bare import 在 Node 运行时解析到 TS 源码的问题。

### 5) 同步开发约束到文档

将修改：

- [docs/development.md](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/docs/development.md)
- [AGENTS.md](file:///Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/AGENTS.md)

新增约束条目（措辞会贴合现有风格）：

- 跨 workspace 包引用只能用包名顶级入口：`import { ... } from "@devtrend/<pkg>"`
- 禁止跨包相对路径 / 深导入 `packages/<pkg>/src/**`
- 新增对外 API 必须通过对应包的 `src/index.ts` 导出

## Assumptions & Decisions

- 所有 workspace 包均为 `type: "module"` + `tsconfig.base.json` 使用 `moduleResolution: "NodeNext"`；执行环境通过 `tsx` 提供 TS/ESM loader。
- 本阶段不引入新的构建/打包工具（不新增依赖、不改 Turbo pipeline），只通过 `exports` + 统一导出入口达成约束。

## Verification Steps

- 静态检查：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- 约束回归：
  - grep 确认不存在跨包相对 import（例如 `../packages/*/src`、`../contracts/src`）
- 启动验证（可选但建议）：
  - `pnpm dev:api`
  - `pnpm dev:worker`
  - `pnpm --filter @devtrend/api start`
  - `pnpm --filter @devtrend/worker start`

