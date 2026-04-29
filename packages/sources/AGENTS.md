# packages/sources（OpenCLI 数据源与合约审计）

## 职责

- 维护 OpenCLI command registry 与 source adapters 的最小封装
- 执行 contract audit（registry/help/sample fixtures）
- 提供 collectors 与 normalizers，把外部站点输出收敛成稳定的归一化 item

## 边界与禁止项

- 仅允许 public sources（不需要登录态/cookie）
- 不接入 GitHub API / GH Archive
- contract audit 不依赖 `opencli verify --smoke`，必须执行真实子命令采样

## 关键入口

- OpenCLI 封装： [opencli.ts](./src/opencli.ts)
- 命令注册表： [command-registry.ts](./src/command-registry.ts)
- Collectors： [collectors/index.ts](./src/collectors/index.ts)
- Normalizers： [normalizers/index.ts](./src/normalizers/index.ts)
- 合约审计： [run-contract-audit.ts](./src/audit/run-contract-audit.ts)

## fixtures

- `fixtures/helps/*`：`--help` 快照
- `fixtures/samples/*`：代表性 JSON 样本（用于回归与 contract 漂移检测）

## 验证方式

- Normalizers 测试： [normalizers.test.ts](../../test/packages/sources/normalizers.test.ts)
- 合约样本回归： [contract-fixtures.test.ts](../../test/packages/sources/contract-fixtures.test.ts)
