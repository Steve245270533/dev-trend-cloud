# DevTrend Cloud

DevTrend Cloud is a backend-first intelligence pipeline for compressing scattered developer signals into actionable `question pressure` and `open-source adoption` evidence.

This repository implements `Phase 0 + Phase 1` from [docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md](/Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md) only.

## Phase Scope

Implemented in this repository:

- `pnpm` monorepo structure with `apps/api`, `apps/worker`, `apps/web`, and shared `packages/*`
- `TypeScript + SWC + Fastify + BullMQ + Postgres + Redis`
- OpenCLI contract audit helpers for public sources
- P0/P1 data pipeline foundations:
  - raw snapshot capture
  - item normalization
  - topic/entity matching
  - rule-based question extraction
  - rule-based question clustering
  - question pressure scoring
  - evidence drilldown
- Read-only HTTP APIs:
  - `GET /healthz`
  - `GET /readyz`
  - `GET /feed`
  - `GET /signals/question-pressure`
  - `GET /question-clusters/:clusterId`
  - `GET /question-clusters/:clusterId/evidence`

Explicitly out of scope in this phase:

- authentication and authorization
- usage billing or quotas
- team accounts
- watchlist CRUD API
- digest and webhook delivery
- analyst console / frontend productization
- full GitHub intelligence pipeline

## Architecture

```text
OpenCLI public adapters
  -> contract audit
  -> raw snapshots
  -> normalizers
  -> topic/entity matcher
  -> question extractor
  -> question clusterer
  -> question pressure scorer
  -> Postgres persistence
  -> Redis cache
  -> Fastify read API

BullMQ worker
  -> contract-audit
  -> collect
  -> normalize
  -> match
  -> cluster
  -> score
```

## Workspace Layout

```text
apps/
  api/       Fastify read API
  worker/    BullMQ schedulers and jobs
  web/       Reserved placeholder for future frontend
packages/
  config/    Environment schema and runtime config
  contracts/ Shared TypeBox schemas and DTOs
  db/        SQL migrations, seeds, repositories
  domain/    Matching, question extraction, clustering, scoring
  sources/   OpenCLI command registry, collectors, normalizers, fixtures
docs/
  plan/      Product and delivery plans
  reports/   Contract audit and manual report output location
```

## Prerequisites

- Node.js `24.x`
- `pnpm` `10.x`
- Docker services at `/Users/lehuaixiaochen/Downloads/Project/Docker`
- `opencli` installed and available on `PATH`

The current implementation expects these public OpenCLI sources:

- Stack Overflow
- Hacker News
- DEV
- OSSInsight

## Infrastructure

This project extends `/Users/lehuaixiaochen/Downloads/Project/Docker/docker-compose.yml`.

Phase 0 + Phase 1 assumes:

- Postgres image upgraded to `pgvector/pgvector:pg16`
- Redis kept as-is
- Postgres init SQL enables:
  - `vector`
  - `pg_trgm`
  - `unaccent`
  - `pgcrypto`

## Environment Variables

Copy `.env.example` to `.env` and adjust values as needed.

Core variables:

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

For the current shared Docker baseline, Redis authentication is enabled via `/Users/lehuaixiaochen/Downloads/Project/Docker/redis/redis.conf`, so the default local URL is:

```text
redis://:123456@127.0.0.1:6379
```

## Development

Install dependencies:

```bash
pnpm install
```

Run database migrations:

```bash
pnpm db:migrate
```

Seed phase data:

```bash
pnpm db:seed
```

Start the API in watch mode:

```bash
pnpm dev:api
```

Start the worker in watch mode:

```bash
pnpm dev:worker
```

Run both through Turbo:

```bash
pnpm dev
```

Build the repository:

```bash
pnpm build
```

Run type checks:

```bash
pnpm typecheck
```

Run tests:

```bash
pnpm test
```

Run the OpenCLI contract audit:

```bash
pnpm audit:contracts
```

## API Response Shape

All read endpoints return:

```json
{
  "data": [],
  "meta": {
    "generatedAt": "2026-04-29T00:00:00.000Z",
    "freshnessMinutes": 15,
    "fallbackUsed": false,
    "sourceStatus": {
      "stackoverflow": {
        "status": "healthy",
        "lastSuccessAt": "2026-04-29T00:00:00.000Z"
      }
    }
  }
}
```

`/signals/question-pressure` items include:

- `clusterId`
- `canonicalQuestion`
- `pressureScore`
- `unresolvedVolume`
- `growthLabel`
- `affectedTopics`
- `affectedEntities`
- `relatedRepos`
- `sourceDistribution`
- `evidenceCount`
- `recommendedAction`
- `confidenceScore`
- `freshnessMinutes`
- `fallbackUsed`

## Notes About Context7

Context7 MCP is treated as an implementation-time reference source for up-to-date framework documentation. It is not a runtime dependency and does not affect API or worker execution.

## Seed Data

The repository includes these initial watchlists:

- `AI agent evals`
- `MCP / tool calling`
- `Vector database adoption`

It also seeds a topic/entity catalog for first-phase matching and demos.
