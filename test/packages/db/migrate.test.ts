import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runMigrations } from "@devtrend/db";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("runMigrations executes sorted SQL files and closes pool", async () => {
  const migrationsDir = await mkdtemp(join(tmpdir(), "devtrend-migrations-"));
  await writeFile(join(migrationsDir, "002_second.sql"), "SELECT 2;", "utf8");
  await writeFile(join(migrationsDir, "001_first.sql"), "SELECT 1;", "utf8");

  const queries: string[] = [];
  let ended = false;

  const appliedFiles = await runMigrations("postgres://example", {
    migrationsDir,
    createPool: () => ({
      async query(sql) {
        queries.push(sql.trim());
      },
      async end() {
        ended = true;
      },
    }),
  });

  await rm(migrationsDir, { recursive: true, force: true });

  assert.deepEqual(appliedFiles, ["001_first.sql", "002_second.sql"]);
  assert.deepEqual(queries, ["SELECT 1;", "SELECT 2;"]);
  assert.equal(ended, true);
});

test("runMigrations still closes pool when SQL execution fails", async () => {
  const migrationsDir = await mkdtemp(
    join(tmpdir(), "devtrend-migrations-fail-"),
  );
  await writeFile(join(migrationsDir, "001_fail.sql"), "SELECT FAIL;", "utf8");

  let ended = false;

  await assert.rejects(
    runMigrations("postgres://example", {
      migrationsDir,
      createPool: () => ({
        async query() {
          throw new Error("migration failed");
        },
        async end() {
          ended = true;
        },
      }),
    }),
  );

  await rm(migrationsDir, { recursive: true, force: true });
  assert.equal(ended, true);
});

test("unified content migration keeps executable safety guards", async () => {
  const migrationSql = await readFile(
    join(repoRoot, "packages/db/migrations/003_unified_content.sql"),
    "utf8",
  );

  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS unified_contents/);
  assert.match(migrationSql, /timestamp_origin IN \('source', 'collected'\)/);
  assert.match(migrationSql, /UNIQUE \(source, source_item_id\)/);
  assert.match(
    migrationSql,
    /legacy_item_id UUID NOT NULL REFERENCES items \(id\) ON DELETE CASCADE/,
  );
});

test("embedding migration defines pgvector table constraints and dedupe index", async () => {
  const migrationSql = await readFile(
    join(repoRoot, "packages/db/migrations/004_embedding_records.sql"),
    "utf8",
  );

  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS embedding_records/);
  assert.match(migrationSql, /embedding_vector VECTOR NOT NULL/);
  assert.match(
    migrationSql,
    /status IN \('pending', 'processing', 'succeeded', 'failed', 'superseded'\)/,
  );
  assert.match(
    migrationSql,
    /ON embedding_records \(source, content_fingerprint, model, input_schema_version\)/,
  );
  assert.doesNotMatch(
    migrationSql,
    /USING ivfflat \(embedding_vector vector_cosine_ops\)/,
  );
  assert.match(migrationSql, /先不创建 ANN 向量索引/);
});

test("topic cluster migration defines versioned cluster and membership tables", async () => {
  const migrationSql = await readFile(
    join(repoRoot, "packages/db/migrations/005_topic_clusters.sql"),
    "utf8",
  );

  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS topic_clusters/);
  assert.match(migrationSql, /cluster_version TEXT NOT NULL/);
  assert.match(
    migrationSql,
    /runtime_fallback_reason IN \(\s*'missing-cluster',\s*'low-confidence'/,
  );
  assert.match(
    migrationSql,
    /CREATE TABLE IF NOT EXISTS topic_cluster_memberships/,
  );
  assert.match(
    migrationSql,
    /UNIQUE \(topic_cluster_id, canonical_id, cluster_version\)/,
  );
});
