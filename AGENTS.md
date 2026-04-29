# Repository Agent Guide

This file defines how coding agents should work inside `dev-trend-cloud`.

## Source of Truth

- Final product and scope reference:
  [docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md](/Users/lehuaixiaochen/Downloads/Project/dev-trend-cloud/docs/plan/devtrend-cloud-practical-plan-2026-04-29-v4.md)
- Current delivery boundary:
  `Phase 0 + Phase 1` only

If implementation details conflict with older notes, always follow the `2026-04-29 v4` plan.

## Required Build Order

Agents must implement in this order:

1. documentation
2. monorepo and toolchain
3. database and seed catalog
4. source collectors and contract audit
5. domain pipeline
6. API and worker
7. tests and verification

Do not skip directly to Phase 2 behavior.

## Scope Guardrails

Allowed in this repository now:

- Question Pressure MVP
- read-only API endpoints
- OpenCLI public-source audit and collectors
- topic/entity seed matching
- rule-based clustering and scoring
- Postgres + Redis runtime
- BullMQ background processing

Not allowed in this phase:

- auth, API keys, RBAC
- billing, usage accounting, quotas
- watchlist CRUD API
- digest, scheduled exports, webhook delivery
- console UI beyond placeholder `apps/web`
- GitHub API / GH Archive ingestion
- social sources that require login or cookie flows

## Technical Expectations

- Use `pnpm` workspaces for package boundaries.
- Use `TypeScript + SWC` for development and build flow.
- Use Fastify conventions:
  - `@fastify/type-provider-typebox`
  - `env-schema`
  - structured error responses
  - health and readiness endpoints
- Use BullMQ for scheduling and async orchestration.
- Prefer deterministic rules over LLM-only behavior for pipeline decisions.

## Data Pipeline Expectations

- `raw_snapshots` stores raw source payloads in `JSONB`.
- contract audit should store:
  - registry snapshot
  - `--help` snapshot
  - representative JSON fixture output
- question clustering must stay rule-first:
  - normalized title
  - token overlap
  - `pg_trgm` similarity
  - topic/entity overlap
  - time window grouping
- `pgvector` may be enabled in infrastructure, but it is not the primary clustering dependency in this phase.

## OpenCLI Rules

- Do not rely on `opencli verify --smoke` as the primary smoke mechanism in this environment.
- Execute real subcommands directly for contract audit and sample capture.
- Current source set is limited to:
  - Stack Overflow
  - Hacker News
  - DEV
  - OSSInsight

## Testing Rules

Minimum coverage should include:

- normalizers
- topic/entity matcher
- question extraction
- clusterer
- scorer
- source health and fallback handling
- Fastify route integration with `inject()`

## File Ownership

- `apps/api`: transport, schema, caching, API composition
- `apps/worker`: jobs, scheduling, orchestration
- `packages/config`: config schema and loaders
- `packages/contracts`: shared DTOs and TypeBox schemas
- `packages/db`: migrations, seeds, repository helpers
- `packages/domain`: deterministic signal logic
- `packages/sources`: OpenCLI command registry and source adapters

## Practical Defaults

- Keep the implementation backend-first and demoable.
- Prefer simple SQL and JSONB over heavy ORM abstraction for this phase.
- Prefer repository helpers and explicit queries over hidden magic.
- Reserve `apps/web` only as a placeholder for future work.
