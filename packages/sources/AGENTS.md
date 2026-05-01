# packages/sources（OpenCLI 数据源与合约审计）

## 职责

- 维护 OpenCLI command registry、adapter registry、route policy 与 source task 抽象
- 执行 contract audit（registry/help/sample fixtures）
- 提供 collectors、circuit breaker 协议与 normalizers，把外部站点输出收敛成稳定的归一化 item
- 提供 runtime topic discovery adapters，把 OSSInsight / DEV 的发现逻辑与内容采集统一到同一套抽象

## 边界与禁止项

- 仅允许 public sources（不需要登录态/cookie）
- 不接入 GitHub API / GH Archive
- contract audit 不依赖 `opencli verify --smoke`，必须执行真实子命令采样
- contract audit 必须绕过 breaker，不允许被熔断或自动降级掩盖

## 关键入口

- OpenCLI 封装： [opencli.ts](./src/opencli.ts)
- 命令注册表： [command-registry.ts](./src/command-registry.ts)
- Adapter Registry： [registry.ts](./src/registry.ts)
- Adapter Types / Breaker Types： [types.ts](./src/types.ts)
- Adapter 实现： [adapters/index.ts](./src/adapters/index.ts)
- Collectors： [collectors/index.ts](./src/collectors/index.ts)
- Normalizers： [normalizers/index.ts](./src/normalizers/index.ts)
- Runtime Topic Discovery： [runtime-topics.ts](./src/runtime-topics.ts)
- 合约审计： [run-contract-audit.ts](./src/audit/run-contract-audit.ts)

## fixtures

- `fixtures/helps/*`：`--help` 快照
- `fixtures/samples/*`：代表性 JSON 样本（用于回归与 contract 漂移检测）

## 验证方式

- Normalizers 测试： [normalizers.test.ts](../../test/packages/sources/normalizers.test.ts)
- Collectors / Breaker / Discovery 测试： [collectors.test.ts](../../test/packages/sources/collectors.test.ts)
- 合约样本回归： [contract-fixtures.test.ts](../../test/packages/sources/contract-fixtures.test.ts)
- 关键语义：
  - 单个 source/task 失败不能阻塞其它 source
  - no-clear-on-hard-fail：没有 usable payload 的 source 不得清空历史 items
  - runtime topic discovery 允许部分成功
