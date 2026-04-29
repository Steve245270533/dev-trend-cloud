# packages/config（运行时配置）

## 职责

- 定义环境变量 schema 与默认值
- 提供运行时配置加载与校验能力（供 API/worker 复用）

## 边界与禁止项

- 不在此包内放业务规则（domain 逻辑归 `packages/domain`）
- 不在配置层引入外部网络依赖

## 关键入口

- 配置入口： [index.ts](./src/index.ts)
