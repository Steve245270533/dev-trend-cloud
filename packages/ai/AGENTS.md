# packages/ai（本地模型适配层）

## 职责

- 封装本地模型 provider 的请求细节与超时控制
- 提供 embedding / topic naming 的通用请求类型与生成器接口
- 收口 provider 响应校验、JSON transport 解析与错误边界

## 边界与禁止项

- 不在此包内放 topic merge、taxonomy、fallback 等 domain 决策
- 不做 DB、队列、HTTP API 持久化或编排逻辑
- 不把核心业务评分或最终置信度裁决交给 LLM

## 关键入口

- 包入口： [index.ts](./src/index.ts)
- Ollama 适配： [ollama.ts](./src/ollama.ts)

## 验证方式

- AI transport 测试： [ollama.test.ts](../../test/packages/ai/ollama.test.ts)
- 迁移后需继续通过 worker pipeline 集成测试，确保 provider 失败时仍走 deterministic fallback
