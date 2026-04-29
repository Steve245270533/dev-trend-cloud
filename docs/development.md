# 开发

本文件承载本仓库的开发、运行与基础设施信息。顶层架构请先阅读 [architecture.md](../architecture.md)。

## 前置条件

- Node.js `24.x`
- `pnpm` `10.x`
- `opencli` 已安装并可在 `PATH` 中访问
- Docker services at `/Users/lehuaixiaochen/Downloads/Project/Docker`

当前实现期望这些 public OpenCLI sources：

- Stack Overflow
- Hacker News
- DEV
- OSSInsight

## 工程约束

- workspace 子包之间引用只能使用包名顶级入口：`import { ... } from "@devtrend/<pkg>"`
- 禁止跨包相对路径或深导入 `packages/<pkg>/src/**`（例如 `../../contracts/src/index.js`）
- 新增对外 API 必须通过对应包的 `src/index.ts` 导出

## 基础设施

本项目扩展 `/Users/lehuaixiaochen/Downloads/Project/Docker/docker-compose.yml`。

Phase 0 + Phase 1 假设：

- Postgres 镜像升级为 `pgvector/pgvector:pg16`
- Redis 保持不变
- Postgres 初始化 SQL 启用：
  - `vector`
  - `pg_trgm`
  - `unaccent`
  - `pgcrypto`

## 环境变量

复制 `.env.example` 为 `.env` 并按需调整。

核心变量：

- `PORT`
- `HOST`
- `LOG_LEVEL`
- `DATABASE_URL`
- `REDIS_URL`
- `OPENCLI_BIN`
- `OPENCLI_TIMEOUT_MS`
- `CACHE_TTL_MINUTES`
- `QUEUE_PREFIX`
- `SOURCE_POLL_SO_CRON`
- `SOURCE_POLL_HN_CRON`
- `SOURCE_POLL_DEVTO_CRON`
- `SOURCE_POLL_OSSINSIGHT_CRON`

当前共享 Docker baseline 中，Redis 通过 `/Users/lehuaixiaochen/Downloads/Project/Docker/redis/redis.conf` 启用认证，因此本地默认 URL 为：

```text
redis://:123456@127.0.0.1:6379
```

## 常用命令

安装依赖：

```bash
pnpm install
```

运行数据库迁移：

```bash
pnpm db:migrate
```

写入 Phase 数据（seed）：

```bash
pnpm db:seed
```

启动 API（watch）：

```bash
pnpm dev:api
```

启动 worker（watch）：

```bash
pnpm dev:worker
```

通过 Turbo 同时启动：

```bash
pnpm dev
```

构建：

```bash
pnpm build
```

类型检查：

```bash
pnpm typecheck
```

测试：

```bash
pnpm test
```

运行 OpenCLI contract audit：

```bash
pnpm audit:contracts
```

## 种子数据

仓库默认写入一批用于演示的 watchlists 与 topic/entity catalog，用于 Phase 0 + Phase 1 的匹配与 demo。
