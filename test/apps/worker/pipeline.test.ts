import assert from "node:assert/strict";
import test from "node:test";
import type { CollectedSourcePayload } from "@devtrend/sources";
import {
  loadRuntimeTopics,
  persistCollectedPayloads,
  planWorkerBootstrap,
  refreshRuntimeTopicSeeds,
  runEmbeddingBackfillJob,
  runIncrementalEmbeddingJob,
  runTopicClusteringBackfillJob,
  runTopicClusteringJob,
} from "@devtrend/worker";
import type { Pool, PoolClient, QueryResult } from "pg";
import type { WorkerLogger } from "../../../apps/worker/src/services/logger.js";

interface FakeItemRow {
  id: string;
  source: string;
  source_item_id: string;
  title: string;
  summary: string;
  url: string;
  author: string | null;
  published_at: string;
  score: number;
  answer_count: number;
  comment_count: number;
  tags: string[];
  content_type: string;
  is_question: boolean;
  raw_meta: Record<string, unknown>;
}

interface FakeSourceHealthRow {
  source: string;
  status: "healthy" | "degraded" | "failed";
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_text: string | null;
  fallback_used: boolean;
  last_latency_ms: number;
}

interface FakeSnapshotRow {
  snapshot_id: string;
  source_run_id: string;
  source: string;
  command: string;
  collected_at: string;
  payload: Record<string, unknown>[];
}

interface FakeSourceRunRow {
  id: string;
  source: string;
  command: string;
  status: string;
  error_text: string | null;
  fallback_used: boolean;
  records_count: number;
}

interface FakeItemSourceRow {
  item_id: string;
  source: string;
  source_item_id: string;
  command: string;
  source_run_id: string | null;
  snapshot_id: string | null;
  raw_payload: Record<string, unknown>;
  collected_at: string;
}

interface FakeTopicRow {
  id: string;
  slug: string;
  name: string;
  keywords: string[];
  repo_patterns: string[];
}

interface FakeRuntimeTopicSeedRunRow {
  id: string;
  status: string;
  fallback_used: boolean;
  error_text: string | null;
}

interface FakeRuntimeTopicSeedRow {
  run_id: string;
  slug: string;
  name: string;
  keywords: string[];
  source_priority: number;
  sources: string[];
  collection_id: string | null;
  devto_tags: string[];
  score: number;
  active: boolean;
  refreshed_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

interface FakeUnifiedContentRow {
  canonical_id: string;
  source: string;
  source_item_id: string;
  title: string;
  summary: string;
  body_excerpt: string | null;
  tags: string[];
  fingerprint: string;
  collected_at: string;
  source_features: Record<string, unknown>;
  legacy_item_id: string;
}

interface FakeEmbeddingRow {
  id: string;
  canonical_id: string;
  source: string;
  content_fingerprint: string;
  input_schema_version: string;
  vector?: number[];
  model: string;
  status: "succeeded" | "failed" | "superseded";
}

interface FakeTopicClusterRow {
  id: string;
  topic_cluster_id: string;
  stable_key: string;
  cluster_version: string;
  rule_version: string;
  status: "active" | "superseded";
  slug: string;
  display_name: string;
  summary: string;
  keywords: string[];
  anchor_canonical_id: string;
  representative_evidence: Record<string, unknown>[];
  source_mix: Record<string, unknown>[];
  related_repos: string[];
  related_entities: string[];
  item_count: number;
  cluster_confidence: number;
  runtime_fallback_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface FakeTopicClusterMembershipRow {
  topic_cluster_row_id: string;
  topic_cluster_id: string;
  cluster_version: string;
  canonical_id: string;
  item_id: string;
  embedding_record_id: string | null;
  source: string;
  membership_confidence: number;
  primary_evidence: boolean;
  evidence_rank: number;
  reasoning_tags: string[];
  metadata: Record<string, unknown>;
}

interface StatefulPool {
  executed: string[];
  items: FakeItemRow[];
  signalPayloads: Record<string, unknown>[];
  sourceRuns: FakeSourceRunRow[];
  rawSnapshots: FakeSnapshotRow[];
  itemSources: FakeItemSourceRow[];
  sourceHealth: FakeSourceHealthRow[];
  runtimeTopicSeedRuns: FakeRuntimeTopicSeedRunRow[];
  runtimeTopicSeeds: FakeRuntimeTopicSeedRow[];
  unifiedContents: FakeUnifiedContentRow[];
  embeddingRecords: FakeEmbeddingRow[];
  topicClusters: FakeTopicClusterRow[];
  topicClusterMemberships: FakeTopicClusterMembershipRow[];
  addRuntimeTopicSeed: (seed: FakeRuntimeTopicSeedRow) => void;
  addTopicCluster: (cluster: FakeTopicClusterRow) => void;
  pool: Pool;
}

interface TestLogEntry {
  level: "info" | "warn" | "error";
  event: string;
  context: Record<string, unknown>;
}

function createTestLogger(
  entries: TestLogEntry[] = [],
  baseContext: Record<string, unknown> = {},
): WorkerLogger {
  return {
    async info(event, context = {}) {
      entries.push({
        level: "info",
        event,
        context: { ...baseContext, ...context },
      });
    },
    async warn(event, context = {}) {
      entries.push({
        level: "warn",
        event,
        context: { ...baseContext, ...context },
      });
    },
    async error(event, context = {}) {
      entries.push({
        level: "error",
        event,
        context: { ...baseContext, ...context },
      });
    },
    child(context) {
      return createTestLogger(entries, { ...baseContext, ...context });
    },
  };
}

function buildCollectedPayload(
  source: CollectedSourcePayload["source"],
  commandName: string,
  payload: Record<string, unknown>[],
  overrides: Partial<CollectedSourcePayload> = {},
): CollectedSourcePayload {
  return {
    source,
    capability:
      source === "ossinsight"
        ? "adoption"
        : commandName === "search" || commandName === "tag"
          ? "search"
          : "feed",
    taskKey: `${source}:${commandName}`,
    breakerKey: `${source}:${source === "ossinsight" ? "adoption" : "feed"}:${commandName}`,
    adapterKey: `${source}-default`,
    routeRole: "primary",
    executionDecision: "executed",
    commandName,
    argv: [source, commandName, "--limit", "5", "-f", "json"],
    startedAt: "2026-04-29T00:00:00.000Z",
    finishedAt: "2026-04-29T00:00:02.000Z",
    latencyMs: 2000,
    status: "success",
    errorText: null,
    helpOutput: "usage",
    payload,
    ...overrides,
  };
}

function createStatefulPool(): StatefulPool {
  const executed: string[] = [];
  const items = new Map<string, FakeItemRow>();
  const sourceHealth = new Map<string, FakeSourceHealthRow>();
  const rawSnapshots: FakeSnapshotRow[] = [];
  const sourceRuns: FakeSourceRunRow[] = [];
  const itemSources = new Map<string, FakeItemSourceRow>();
  const topics = new Map<string, FakeTopicRow>();
  const unifiedContents = new Map<string, FakeUnifiedContentRow>();
  const embeddingRecords = new Map<string, FakeEmbeddingRow>();
  const topicClusters = new Map<string, FakeTopicClusterRow>();
  const topicClusterMemberships = new Map<
    string,
    FakeTopicClusterMembershipRow[]
  >();
  let runtimeTopicSeeds: FakeRuntimeTopicSeedRow[] = [];
  const runtimeTopicSeedRuns: FakeRuntimeTopicSeedRunRow[] = [];
  let signalPayloads: Record<string, unknown>[] = [];

  const client = {
    async query(text: string, params?: unknown[]) {
      executed.push(text);

      if (
        text === "BEGIN" ||
        text === "COMMIT" ||
        text === "ROLLBACK" ||
        text.includes("DELETE FROM signal_evidence") ||
        text.includes("DELETE FROM question_cluster_items") ||
        text.includes("DELETE FROM question_clusters") ||
        text.includes("DELETE FROM item_topics") ||
        text.includes("DELETE FROM item_entities") ||
        text.includes("INSERT INTO item_topics") ||
        text.includes("INSERT INTO item_entities") ||
        text.includes("INSERT INTO question_clusters") ||
        text.includes("INSERT INTO signal_evidence") ||
        text.includes("INSERT INTO question_cluster_items")
      ) {
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO topic_clusters")) {
        const key = `${String(params?.[0])}:${String(params?.[2])}`;
        const row: FakeTopicClusterRow = {
          id:
            topicClusters.get(key)?.id ??
            `topic-cluster-row-${topicClusters.size + 1}`,
          topic_cluster_id: String(params?.[0]),
          stable_key: String(params?.[1]),
          cluster_version: String(params?.[2]),
          rule_version: String(params?.[3]),
          status: String(params?.[4]) as FakeTopicClusterRow["status"],
          slug: String(params?.[5]),
          display_name: String(params?.[6]),
          summary: String(params?.[7]),
          keywords: Array.isArray(params?.[8]) ? params[8].map(String) : [],
          anchor_canonical_id: String(params?.[9]),
          representative_evidence:
            typeof params?.[10] === "string"
              ? (JSON.parse(String(params[10])) as Record<string, unknown>[])
              : [],
          source_mix:
            typeof params?.[11] === "string"
              ? (JSON.parse(String(params[11])) as Record<string, unknown>[])
              : [],
          related_repos: Array.isArray(params?.[12])
            ? params[12].map(String)
            : [],
          related_entities: Array.isArray(params?.[13])
            ? params[13].map(String)
            : [],
          item_count: Number(params?.[14] ?? 0),
          cluster_confidence: Number(params?.[15] ?? 0),
          runtime_fallback_reason:
            typeof params?.[16] === "string" ? String(params[16]) : null,
          metadata:
            typeof params?.[17] === "string"
              ? (JSON.parse(String(params[17])) as Record<string, unknown>)
              : {},
          created_at: "2026-05-06T00:00:00.000Z",
          updated_at: "2026-05-06T00:10:00.000Z",
        };
        topicClusters.set(key, row);
        return { rows: [row] } as unknown as QueryResult;
      }

      if (text.includes("DELETE FROM topic_cluster_memberships")) {
        topicClusterMemberships.set(String(params?.[0]), []);
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO topic_cluster_memberships")) {
        const key = String(params?.[0]);
        const rows = topicClusterMemberships.get(key) ?? [];
        rows.push({
          topic_cluster_row_id: key,
          topic_cluster_id: String(params?.[1]),
          cluster_version: String(params?.[2]),
          canonical_id: String(params?.[3]),
          item_id: String(params?.[4]),
          embedding_record_id:
            typeof params?.[5] === "string" ? String(params[5]) : null,
          source: String(params?.[6]),
          membership_confidence: Number(params?.[7] ?? 0),
          primary_evidence: params?.[8] === true,
          evidence_rank: Number(params?.[9] ?? 0),
          reasoning_tags: Array.isArray(params?.[10])
            ? params[10].map(String)
            : [],
          metadata:
            typeof params?.[11] === "string"
              ? (JSON.parse(String(params[11])) as Record<string, unknown>)
              : {},
        });
        topicClusterMemberships.set(key, rows);
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("UPDATE topic_clusters")) {
        for (const row of topicClusters.values()) {
          if (row.rule_version === String(params?.[0])) {
            row.status = "superseded";
          }
        }
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO runtime_topic_seed_runs")) {
        runtimeTopicSeedRuns.push({
          id: String(params?.[0]),
          status: String(params?.[1]),
          fallback_used: params?.[4] === true,
          error_text:
            typeof params?.[5] === "string" ? String(params[5]) : null,
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (
        text.includes(
          "UPDATE runtime_topic_seeds SET active = FALSE WHERE active = TRUE",
        )
      ) {
        runtimeTopicSeeds = runtimeTopicSeeds.map((seed) => ({
          ...seed,
          active: false,
        }));
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO runtime_topic_seeds")) {
        runtimeTopicSeeds.push({
          run_id: String(params?.[0]),
          slug: String(params?.[1]),
          name: String(params?.[2]),
          keywords: Array.isArray(params?.[3]) ? params[3].map(String) : [],
          source_priority: Number(params?.[4] ?? 0),
          sources:
            typeof params?.[5] === "string"
              ? (JSON.parse(String(params[5])) as string[])
              : [],
          collection_id:
            typeof params?.[6] === "string" ? String(params[6]) : null,
          devto_tags: Array.isArray(params?.[7]) ? params[7].map(String) : [],
          score: Number(params?.[8] ?? 0),
          active: params?.[9] === true,
          refreshed_at: String(params?.[10]),
          expires_at: String(params?.[11]),
          metadata:
            typeof params?.[12] === "string"
              ? (JSON.parse(String(params[12])) as Record<string, unknown>)
              : {},
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (
        text.includes("SELECT run_id") &&
        text.includes("FROM runtime_topic_seeds")
      ) {
        const latest = [...runtimeTopicSeeds]
          .sort((left, right) =>
            right.refreshed_at.localeCompare(left.refreshed_at),
          )
          .at(0);
        return {
          rows: latest ? [{ run_id: latest.run_id }] : [],
        } as unknown as QueryResult;
      }

      if (
        text.includes("FROM runtime_topic_seeds") &&
        text.includes("WHERE run_id = $1")
      ) {
        return {
          rows: runtimeTopicSeeds
            .filter((seed) => seed.run_id === String(params?.[0]))
            .sort((left, right) => right.score - left.score),
        } as unknown as QueryResult;
      }

      if (
        text.includes("FROM runtime_topic_seeds") &&
        text.includes("WHERE active = TRUE")
      ) {
        return {
          rows: runtimeTopicSeeds
            .filter(
              (seed) =>
                seed.active === true &&
                new Date(seed.expires_at).getTime() > Date.now(),
            )
            .sort((left, right) => right.score - left.score),
        } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO topics")) {
        topics.set(String(params?.[1]), {
          id: String(params?.[0]),
          slug: String(params?.[1]),
          name: String(params?.[2]),
          keywords: Array.isArray(params?.[3]) ? params[3].map(String) : [],
          repo_patterns: Array.isArray(params?.[4])
            ? params[4].map(String)
            : [],
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO entities")) {
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO source_runs")) {
        sourceRuns.push({
          id: String(params?.[0]),
          source: String(params?.[1]),
          command: String(params?.[2]),
          status: String(params?.[3]),
          error_text:
            typeof params?.[6] === "string" ? String(params[6]) : null,
          fallback_used: params?.[7] === true,
          records_count: Number(params?.[8] ?? 0),
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO raw_snapshots")) {
        rawSnapshots.push({
          snapshot_id: String(params?.[0]),
          source_run_id: String(params?.[1]),
          source: String(params?.[2]),
          command: String(params?.[3]),
          collected_at: String(params?.[6]),
          payload:
            typeof params?.[5] === "string"
              ? (JSON.parse(String(params[5])) as Record<string, unknown>[])
              : [],
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("FROM raw_snapshots rs")) {
        const source = String(params?.[0]);
        const commandName = String(params?.[1]);
        const snapshot = [...rawSnapshots]
          .filter(
            (entry) => entry.source === source && entry.command === commandName,
          )
          .sort((left, right) =>
            left.collected_at.localeCompare(right.collected_at),
          )
          .at(-1);

        return {
          rows: snapshot
            ? [
                {
                  snapshot_id: snapshot.snapshot_id,
                  source_run_id: snapshot.source_run_id,
                  collected_at: snapshot.collected_at,
                  payload: snapshot.payload,
                },
              ]
            : [],
        } as unknown as QueryResult;
      }

      if (text.includes("DELETE FROM items WHERE source = ANY")) {
        const sources = Array.isArray(params?.[0]) ? params[0].map(String) : [];

        for (const [key, item] of items.entries()) {
          if (sources.includes(item.source)) {
            items.delete(key);
            itemSources.delete(key);
          }
        }

        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO source_health")) {
        const source = String(params?.[0]);
        sourceHealth.set(source, {
          source,
          status: params?.[1] as FakeSourceHealthRow["status"],
          last_success_at:
            typeof params?.[2] === "string" ? String(params[2]) : null,
          last_error_at:
            typeof params?.[3] === "string" ? String(params[3]) : null,
          last_error_text:
            typeof params?.[4] === "string" ? String(params[4]) : null,
          fallback_used: params?.[5] === true,
          last_latency_ms: Number(params?.[6] ?? 0),
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("FROM source_health")) {
        return {
          rows: [...sourceHealth.values()],
        } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO items")) {
        const row: FakeItemRow = {
          id: String(params?.[0]),
          source: String(params?.[2]),
          source_item_id: String(params?.[3]),
          title: String(params?.[4]),
          summary: String(params?.[5]),
          url: String(params?.[6]),
          author: typeof params?.[7] === "string" ? String(params[7]) : null,
          published_at: String(params?.[8]),
          score: Number(params?.[9]),
          answer_count: Number(params?.[10]),
          comment_count: Number(params?.[11]),
          tags: Array.isArray(params?.[12]) ? params[12].map(String) : [],
          content_type: String(params?.[13]),
          is_question: Boolean(params?.[14]),
          raw_meta:
            typeof params?.[15] === "string"
              ? (JSON.parse(String(params[15])) as Record<string, unknown>)
              : {},
        };

        items.set(`${row.source}:${row.source_item_id}`, row);
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO item_sources")) {
        const key = `${String(params?.[2])}:${String(params?.[3])}`;
        itemSources.set(key, {
          item_id: String(params?.[1]),
          source: String(params?.[2]),
          source_item_id: String(params?.[3]),
          command: String(params?.[4]),
          source_run_id:
            typeof params?.[5] === "string" ? String(params[5]) : null,
          snapshot_id:
            typeof params?.[6] === "string" ? String(params[6]) : null,
          raw_payload:
            typeof params?.[7] === "string"
              ? (JSON.parse(String(params[7])) as Record<string, unknown>)
              : {},
          collected_at: String(params?.[8]),
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO unified_contents")) {
        const key = `${String(params?.[1])}:${String(params?.[2])}`;
        unifiedContents.set(key, {
          canonical_id: String(params?.[0]),
          source: String(params?.[1]),
          source_item_id: String(params?.[2]),
          title: String(params?.[3]),
          summary: String(params?.[4]),
          body_excerpt:
            typeof params?.[5] === "string" ? String(params[5]) : null,
          tags: Array.isArray(params?.[11]) ? params[11].map(String) : [],
          fingerprint: String(params?.[13]),
          collected_at: String(params?.[9]),
          source_features:
            typeof params?.[12] === "string"
              ? (JSON.parse(String(params[12])) as Record<string, unknown>)
              : {},
          legacy_item_id: String(params?.[15]),
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (
        text.includes("FROM unified_contents uc") &&
        text.includes("LEFT JOIN embedding_records er")
      ) {
        const sourceFilter =
          typeof params?.[0] === "string" ? String(params[0]) : null;
        const model = String(params?.[1]);
        const inputSchemaVersion = String(params?.[2]);
        const failedStatuses = Array.isArray(params?.[3])
          ? params[3].map(String)
          : [];
        const limit = Number(params?.[4] ?? 100);

        const rows = [...unifiedContents.values()]
          .filter((record) => !sourceFilter || record.source === sourceFilter)
          .sort((left, right) =>
            right.collected_at.localeCompare(left.collected_at),
          )
          .filter((record) => {
            const embedding = [...embeddingRecords.values()].find(
              (entry) =>
                entry.source === record.source &&
                entry.content_fingerprint === record.fingerprint &&
                entry.model === model &&
                entry.input_schema_version === inputSchemaVersion &&
                entry.status !== "superseded",
            );
            if (!embedding) {
              return true;
            }
            return failedStatuses.includes(embedding.status);
          })
          .slice(0, limit)
          .map((record) => ({
            canonical_id: record.canonical_id,
            source: record.source,
            fingerprint: record.fingerprint,
            collected_at: record.collected_at,
          }));

        return { rows } as unknown as QueryResult;
      }

      if (
        text.includes("FROM unified_contents") &&
        text.includes("WHERE canonical_id = ANY")
      ) {
        const canonicalIds = Array.isArray(params?.[0])
          ? new Set(params[0].map(String))
          : new Set<string>();
        const rows = [...unifiedContents.values()]
          .filter((record) => canonicalIds.has(record.canonical_id))
          .map((record) => ({
            canonical_id: record.canonical_id,
            source: record.source,
            source_item_id: record.source_item_id,
            title: record.title,
            summary: record.summary,
            body_excerpt: record.body_excerpt,
            url: `https://example.com/${record.source_item_id}`,
            author: "author",
            published_at: "2026-04-29T00:00:00.000Z",
            collected_at: record.collected_at,
            timestamp_origin: "source",
            tags: record.tags,
            source_features: record.source_features,
            fingerprint: record.fingerprint,
            evidence_refs: [],
            legacy_item_id: record.legacy_item_id,
            legacy_item_source_id: null,
            raw_meta: {},
          }));
        return { rows } as unknown as QueryResult;
      }

      if (text.includes("UPDATE embedding_records")) {
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO embedding_records")) {
        const id = `embedding-${embeddingRecords.size + 1}`;
        const source = String(params?.[1]);
        const contentFingerprint = String(params?.[2]);
        const model = String(params?.[5]);
        const inputSchemaVersion = String(params?.[3]);
        const key = `${source}:${contentFingerprint}:${model}:${inputSchemaVersion}`;
        embeddingRecords.set(key, {
          id,
          canonical_id: String(params?.[0]),
          source,
          content_fingerprint: contentFingerprint,
          input_schema_version: inputSchemaVersion,
          vector:
            typeof params?.[8] === "string"
              ? String(params[8])
                  .slice(1, -1)
                  .split(",")
                  .map((value) => Number(value))
              : [],
          model,
          status: "succeeded",
        });
        return { rows: [{ id }] } as unknown as QueryResult;
      }

      if (
        text.includes("FROM embedding_records") &&
        text.includes("embedding_vector::text AS embedding_vector_text")
      ) {
        const source =
          typeof params?.[1] === "string" ? String(params[1]) : null;
        const model =
          typeof params?.[2] === "string" ? String(params[2]) : null;
        const status =
          typeof params?.[3] === "string" ? String(params[3]) : null;
        const limit = Number(params?.[4] ?? 50);
        const rows = [...embeddingRecords.values()]
          .filter((record) => !source || record.source === source)
          .filter((record) => !model || record.model === model)
          .filter((record) => !status || record.status === status)
          .slice(0, limit)
          .map((record) => ({
            id: record.id,
            canonical_id: record.canonical_id,
            source: record.source,
            content_fingerprint: record.content_fingerprint,
            input_schema_version: record.input_schema_version,
            provider: "ollama",
            model: record.model,
            model_version: record.model,
            dimensions: record.vector?.length ?? 0,
            embedding_vector_text: `[${(record.vector ?? []).join(",")}]`,
            status: record.status,
            error_text: null,
            retry_count: 0,
            metadata: {},
            created_at: "2026-05-06T00:00:00.000Z",
            updated_at: "2026-05-06T00:10:00.000Z",
            succeeded_at: "2026-05-06T00:10:01.000Z",
          }));
        return { rows } as unknown as QueryResult;
      }

      if (
        text.includes("FROM topic_clusters") &&
        text.includes("WHERE status = 'active'")
      ) {
        const rows = [...topicClusters.values()]
          .filter((row) => row.status === "active")
          .sort(
            (left, right) => right.cluster_confidence - left.cluster_confidence,
          );
        return { rows } as unknown as QueryResult;
      }

      if (text.includes("SELECT i.*") && text.includes("FROM items i")) {
        return {
          rows: [...items.values()],
        } as unknown as QueryResult;
      }

      if (text.includes("FROM topics") && text.includes("fallback-topics")) {
        return {
          rows: [...topics.values()].map((topic) => ({
            run_id: "00000000-0000-5000-8000-000000000000",
            slug: topic.slug,
            name: topic.name,
            keywords: topic.keywords,
            source_priority: 10,
            sources: ["fallback-topics"],
            collection_id: null,
            devto_tags: [],
            score: 10,
            active: true,
            refreshed_at: "2026-04-29T00:00:00.000Z",
            expires_at: "2026-04-29T02:00:00.000Z",
            metadata: { fallback: true, source: "topics" },
          })),
        } as unknown as QueryResult;
      }

      if (text.includes("DELETE FROM signals")) {
        signalPayloads = [];
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO signals")) {
        const payload = JSON.parse(String(params?.[12])) as Record<
          string,
          unknown
        >;
        signalPayloads.push(payload);
        return { rows: [] } as unknown as QueryResult;
      }

      throw new Error(`Unhandled query in test double: ${text}`);
    },
    release() {},
  } as unknown as PoolClient;

  return {
    executed,
    get items() {
      return [...items.values()];
    },
    get signalPayloads() {
      return signalPayloads;
    },
    get sourceRuns() {
      return sourceRuns;
    },
    get rawSnapshots() {
      return rawSnapshots;
    },
    get itemSources() {
      return [...itemSources.values()];
    },
    get sourceHealth() {
      return [...sourceHealth.values()];
    },
    get runtimeTopicSeedRuns() {
      return runtimeTopicSeedRuns;
    },
    get runtimeTopicSeeds() {
      return runtimeTopicSeeds;
    },
    get unifiedContents() {
      return [...unifiedContents.values()];
    },
    get embeddingRecords() {
      return [...embeddingRecords.values()];
    },
    get topicClusters() {
      return [...topicClusters.values()];
    },
    get topicClusterMemberships() {
      return [...topicClusterMemberships.values()].flat();
    },
    addRuntimeTopicSeed(seed) {
      runtimeTopicSeeds.push(seed);
    },
    addTopicCluster(cluster) {
      topicClusters.set(
        `${cluster.topic_cluster_id}:${cluster.cluster_version}`,
        cluster,
      );
    },
    pool: {
      async connect() {
        return client;
      },
    } as unknown as Pool,
  };
}

test("persistCollectedPayloads rolls back the transaction on replacement failure", async () => {
  const executed: string[] = [];
  const client = {
    async query(text: string) {
      executed.push(text);

      if (text.includes("INSERT INTO source_health")) {
        throw new Error("write failed");
      }

      return { rows: [] } as unknown as QueryResult;
    },
    release() {},
  } as unknown as PoolClient;

  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;

  await assert.rejects(
    persistCollectedPayloads(pool, [
      buildCollectedPayload("stackoverflow", "hot", [
        {
          title: "How do I debug Model Context Protocol tool registration?",
          score: 12,
          answers: 0,
          url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
        },
      ]),
    ]),
  );

  assert.ok(executed.includes("BEGIN"));
  assert.ok(
    executed.some(
      (text) =>
        text.includes("INSERT INTO source_runs") ||
        text.includes("INSERT INTO raw_snapshots"),
    ),
  );
  assert.ok(executed.includes("ROLLBACK"));
  assert.equal(executed.at(-1), "ROLLBACK");
});

test("persistCollectedPayloads keeps prior sources and rebuilds global signals", async () => {
  const state = createStatefulPool();

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("stackoverflow", "hot", [
      {
        title:
          "How do I debug Model Context Protocol tool registration in Fastify?",
        score: 12,
        answers: 0,
        url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
      },
    ]),
  ]);

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("hackernews", "ask", [
      {
        title:
          "How do I debug Model Context Protocol tool registration in Fastify?",
        score: 29,
        author: "bob",
        comments: 18,
      },
    ]),
  ]);

  assert.deepEqual(state.items.map((item) => item.source).sort(), [
    "hackernews",
    "stackoverflow",
  ]);
  assert.ok(state.executed.some((text) => text.includes("INSERT INTO topics")));
  assert.ok(
    state.executed.some((text) => text.includes("INSERT INTO entities")),
  );
  assert.equal(state.sourceRuns.length, 2);
  assert.equal(state.rawSnapshots.length, 2);
  assert.equal(state.unifiedContents.length, 2);
  assert.ok(
    state.unifiedContents.every((record) => record.legacy_item_id.length > 0),
  );
  assert.ok(
    state.unifiedContents.every((record) =>
      Object.hasOwn(record.source_features, "shared"),
    ),
  );
  assert.ok(
    state.signalPayloads.some((signal) => {
      const distribution = signal.sourceDistribution as Record<string, number>;
      return distribution.stackoverflow === 1;
    }),
  );
  assert.ok(
    state.signalPayloads.some((signal) => {
      const distribution = signal.sourceDistribution as Record<string, number>;
      return distribution.hackernews === 1;
    }),
  );
});

test("persistCollectedPayloads reuses prior snapshots as fallback and degrades source health", async () => {
  const state = createStatefulPool();
  const logs: TestLogEntry[] = [];
  const logger = createTestLogger(logs);

  await persistCollectedPayloads(
    state.pool,
    [
      buildCollectedPayload("stackoverflow", "hot", [
        {
          title:
            "How do I debug Model Context Protocol tool registration in Fastify?",
          score: 12,
          answers: 0,
          url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
        },
      ]),
    ],
    logger,
  );

  const firstSnapshotId = state.rawSnapshots[0]?.snapshot_id;
  assert.ok(firstSnapshotId);

  await persistCollectedPayloads(
    state.pool,
    [
      buildCollectedPayload("stackoverflow", "hot", [], {
        status: "failed",
        errorText: "timeout",
        finishedAt: "2026-04-29T01:00:02.000Z",
        latencyMs: 8000,
      }),
    ],
    logger,
  );

  assert.equal(state.sourceRuns.length, 2);
  assert.equal(state.rawSnapshots.length, 1);
  assert.equal(state.unifiedContents.length, 1);
  assert.equal(state.sourceRuns[1]?.status, "fallback");
  assert.equal(state.sourceHealth[0]?.status, "degraded");
  assert.equal(state.sourceHealth[0]?.fallback_used, true);
  assert.equal(state.sourceHealth[0]?.last_error_text, "timeout");

  const itemSource = state.itemSources[0];
  assert.equal(itemSource?.source_run_id, state.sourceRuns[1]?.id);
  assert.equal(itemSource?.snapshot_id, firstSnapshotId);

  assert.ok(logs.some((entry) => entry.event === "pipeline.persist.start"));
  assert.ok(
    logs.some(
      (entry) =>
        entry.event === "pipeline.persist.pg.recordCollectionArtifacts",
    ),
  );
  assert.ok(
    logs.some(
      (entry) =>
        entry.event === "pipeline.persist.payloads.resolved" &&
        (entry.context.payloadStatusSummary as Record<string, number>)
          .fallback === 1,
    ),
  );
  assert.ok(logs.some((entry) => entry.event === "pipeline.persist.done"));
});

test("persistCollectedPayloads records failed sources when no fallback snapshot exists", async () => {
  const state = createStatefulPool();

  const result = await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("devto", "tag", [], {
      status: "failed",
      errorText: "command timed out",
      finishedAt: "2026-04-29T02:00:02.000Z",
      latencyMs: 6000,
    }),
  ]);

  assert.equal(result.items, 0);
  assert.equal(state.sourceRuns.length, 1);
  assert.equal(state.sourceRuns[0]?.status, "failed");
  assert.equal(state.rawSnapshots.length, 0);
  assert.equal(state.unifiedContents.length, 0);
  assert.equal(state.sourceHealth[0]?.status, "failed");
  assert.equal(state.sourceHealth[0]?.fallback_used, false);
  assert.equal(state.items.length, 0);
});

test("persistCollectedPayloads keeps prior source items when a later run hard-fails without fallback", async () => {
  const state = createStatefulPool();

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("devto", "top", [
      {
        title: "Building a Fastify + BullMQ pipeline for developer signals",
        author: "frank",
        reactions: 48,
        comments: 7,
        tags: ["fastify", "typescript", "bullmq"],
        url: "https://dev.to/example/fastify-bullmq-pipeline",
        published_at: "2026-04-28T10:00:00.000Z",
      },
    ]),
  ]);

  const previousItems = state.items.map((item) => item.source_item_id);
  assert.equal(previousItems.length, 1);

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("devto", "tag", [], {
      status: "failed",
      errorText: "command timed out",
      finishedAt: "2026-04-29T02:00:02.000Z",
      latencyMs: 6000,
    }),
  ]);

  assert.deepEqual(
    state.items.map((item) => item.source_item_id),
    previousItems,
  );
  assert.equal(state.sourceHealth[0]?.status, "failed");
});

test("refreshRuntimeTopicSeeds stores a merged runtime topic snapshot", async () => {
  const state = createStatefulPool();

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("stackoverflow", "hot", [
      {
        title:
          "How do I debug Model Context Protocol tool registration in Fastify?",
        score: 12,
        answers: 0,
        url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
      },
    ]),
  ]);

  const result = await refreshRuntimeTopicSeeds(
    state.pool,
    "opencli",
    1000,
    async () => ({
      candidates: [
        {
          slug: "artificial-intelligence",
          name: "Artificial Intelligence",
          keywords: ["artificial intelligence", "ai"],
          sourcePriority: 100,
          sources: ["ossinsight-hot"],
          collectionId: "10010",
          devtoTags: ["ai"],
          score: 104,
          metadata: {},
        },
      ],
      sourceStatuses: [
        {
          source: "ossinsight",
          status: "success",
          errorText: null,
          candidateCount: 1,
        },
        {
          source: "devto",
          status: "failed",
          errorText: "timeout",
          candidateCount: 0,
        },
      ],
    }),
  );

  const runtimeTopics = await loadRuntimeTopics(state.pool);

  assert.equal(result.status, "degraded");
  assert.equal(result.fallbackUsed, true);
  assert.equal(state.runtimeTopicSeedRuns.length, 1);
  assert.ok(
    state.runtimeTopicSeeds.some(
      (seed) =>
        seed.slug === "artificial-intelligence" &&
        seed.collection_id === "10010",
    ),
  );
  assert.ok(
    runtimeTopics.some((topic) => topic.slug === "artificial-intelligence"),
  );
  assert.ok(runtimeTopics.some((topic) => topic.slug === "mcp"));
});

test("planWorkerBootstrap enqueues refresh and collect when the worker starts from an empty state", () => {
  const plan = planWorkerBootstrap(
    {
      hasActiveRuntimeTopicSnapshot: false,
      hasPersistedItems: false,
    },
    ["stackoverflow", "hackernews", "devto", "ossinsight"],
  );

  assert.equal(plan.refreshRuntimeTopics, true);
  assert.deepEqual(plan.collectSources, [
    "stackoverflow",
    "hackernews",
    "devto",
    "ossinsight",
  ]);
});

test("planWorkerBootstrap only refreshes runtime topics when content already exists", () => {
  const plan = planWorkerBootstrap(
    {
      hasActiveRuntimeTopicSnapshot: false,
      hasPersistedItems: true,
    },
    ["stackoverflow", "hackernews", "devto", "ossinsight"],
  );

  assert.equal(plan.refreshRuntimeTopics, true);
  assert.deepEqual(plan.collectSources, []);
});

test("refreshRuntimeTopicSeeds keeps the prior active snapshot when discovery fully fails", async () => {
  const state = createStatefulPool();
  const logs: TestLogEntry[] = [];
  const logger = createTestLogger(logs);

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("stackoverflow", "hot", [
      {
        title:
          "How do I debug Model Context Protocol tool registration in Fastify?",
        score: 12,
        answers: 0,
        url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
      },
    ]),
  ]);

  await refreshRuntimeTopicSeeds(
    state.pool,
    "opencli",
    1000,
    async () => ({
      candidates: [
        {
          slug: "artificial-intelligence",
          name: "Artificial Intelligence",
          keywords: ["artificial intelligence", "ai"],
          sourcePriority: 100,
          sources: ["ossinsight-hot"],
          collectionId: "10010",
          devtoTags: ["ai"],
          score: 104,
          metadata: {},
        },
      ],
      sourceStatuses: [
        {
          source: "ossinsight",
          status: "success",
          errorText: null,
          candidateCount: 1,
        },
        {
          source: "devto",
          status: "success",
          errorText: null,
          candidateCount: 1,
        },
      ],
    }),
    logger,
  );

  const initialSeeds = state.runtimeTopicSeeds.map((seed) => ({
    slug: seed.slug,
    active: seed.active,
  }));

  const result = await refreshRuntimeTopicSeeds(
    state.pool,
    "opencli",
    1000,
    async () => ({
      candidates: [],
      sourceStatuses: [
        {
          source: "ossinsight",
          status: "failed",
          errorText: "timeout",
          candidateCount: 0,
        },
        {
          source: "devto",
          status: "failed",
          errorText: "timeout",
          candidateCount: 0,
        },
      ],
    }),
    logger,
  );

  assert.equal(result.status, "fallback");
  assert.equal(result.fallbackUsed, true);
  assert.deepEqual(
    state.runtimeTopicSeeds.map((seed) => ({
      slug: seed.slug,
      active: seed.active,
    })),
    initialSeeds,
  );
  assert.equal(state.runtimeTopicSeedRuns.length, 2);
  assert.ok(
    logs.some(
      (entry) =>
        entry.event === "pipeline.runtime-topics.discovery.done" &&
        entry.context.fallbackUsed === true,
    ),
  );
  assert.ok(
    logs.some(
      (entry) => entry.event === "pipeline.runtime-topics.refresh.done",
    ),
  );
});

test("runIncrementalEmbeddingJob persists embeddings without blocking pipeline flow", async () => {
  const state = createStatefulPool();
  const logs: TestLogEntry[] = [];
  const logger = createTestLogger(logs);

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("stackoverflow", "hot", [
      {
        title: "How do I route Fastify MCP tools in worker pipeline?",
        score: 18,
        answers: 1,
        url: "https://stackoverflow.com/questions/10000002/fastify-mcp-worker",
      },
    ]),
  ]);

  const result = await runIncrementalEmbeddingJob(
    state.pool,
    {
      baseUrl: "http://127.0.0.1:11434",
      model: "nomic-embed-text-v2-moe",
      dimensions: 3,
      timeoutMs: 1000,
    },
    { source: "stackoverflow", limit: 10 },
    logger,
    async () => [0.1, 0.2, 0.3],
  );

  assert.equal(result.candidates, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(state.embeddingRecords.length, 1);
  assert.ok(
    logs.some((entry) => entry.event === "pipeline.embedding.batch.start"),
  );
  assert.ok(
    logs.some((entry) => entry.event === "pipeline.embedding.batch.done"),
  );
});

test("runEmbeddingBackfillJob degrades on provider failure and continues processing", async () => {
  const state = createStatefulPool();
  const logs: TestLogEntry[] = [];
  const logger = createTestLogger(logs);

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("devto", "top", [
      {
        title: "Build deterministic embedding pipelines in TypeScript",
        author: "alice",
        reactions: 42,
        comments: 9,
        tags: ["typescript", "pipeline"],
        url: "https://dev.to/example/deterministic-embedding",
        published_at: "2026-04-28T10:00:00.000Z",
      },
    ]),
  ]);

  const result = await runEmbeddingBackfillJob(
    state.pool,
    {
      baseUrl: "http://127.0.0.1:11434",
      model: "nomic-embed-text-v2-moe",
      dimensions: 3,
      timeoutMs: 1000,
    },
    { source: "devto", limit: 10, includeFailed: true },
    logger,
    async () => {
      throw new Error("ollama unavailable");
    },
  );

  assert.equal(result.candidates, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(state.embeddingRecords.length, 0);
  assert.ok(
    logs.some((entry) => entry.event === "pipeline.embedding.record.failed"),
  );
  assert.ok(
    logs.some((entry) => entry.event === "pipeline.embedding.batch.done"),
  );
});

test("runTopicClusteringJob persists topic clusters from succeeded embeddings", async () => {
  const state = createStatefulPool();
  const logs: TestLogEntry[] = [];
  const logger = createTestLogger(logs);

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("stackoverflow", "hot", [
      {
        title: "Why does pgvector return unstable ranking results?",
        score: 18,
        answers: 1,
        url: "https://stackoverflow.com/questions/10000003/pgvector-ranking",
        tags: ["pgvector", "postgres", "rag"],
      },
    ]),
    buildCollectedPayload("devto", "top", [
      {
        title: "Why pgvector ranking feels unstable in production RAG",
        author: "alice",
        reactions: 42,
        comments: 9,
        tags: ["pgvector", "postgres"],
        url: "https://dev.to/example/pgvector-ranking",
        published_at: "2026-04-28T10:00:00.000Z",
      },
    ]),
  ]);

  await runIncrementalEmbeddingJob(
    state.pool,
    {
      baseUrl: "http://127.0.0.1:11434",
      model: "nomic-embed-text-v2-moe",
      dimensions: 3,
      timeoutMs: 1000,
    },
    { limit: 10 },
    logger,
    async (_config, input) => {
      if (input.includes("pgvector")) {
        return [0.92, 0.06, 0.02];
      }
      return [0.2, 0.2, 0.6];
    },
  );

  const result = await runTopicClusteringJob(
    state.pool,
    {
      baseUrl: "http://127.0.0.1:11434",
      model: "nomic-embed-text-v2-moe",
      dimensions: 3,
      timeoutMs: 1000,
    },
    { limit: 10 },
    logger,
  );

  assert.equal(result.embeddings >= 2, true);
  assert.equal(result.clusters >= 1, true);
  assert.equal(state.topicClusters.length >= 1, true);
  assert.equal(state.topicClusterMemberships.length >= 2, true);
  assert.ok(
    logs.some(
      (entry) => entry.event === "pipeline.topic-clustering.batch.done",
    ),
  );
});

test("loadRuntimeTopics prefers dynamic topic clusters before fallback seeds", async () => {
  const state = createStatefulPool();
  const logger = createTestLogger([]);

  state.addRuntimeTopicSeed({
    run_id: "fallback-run",
    slug: "fallback-mcp",
    name: "Fallback MCP",
    keywords: ["mcp"],
    source_priority: 10,
    sources: ["fallback-topics"],
    collection_id: null,
    devto_tags: [],
    score: 10,
    active: true,
    refreshed_at: "2099-05-06T00:00:00.000Z",
    expires_at: "2099-05-06T02:00:00.000Z",
    metadata: {},
  });
  state.addTopicCluster({
    id: "cluster-row-1",
    topic_cluster_id: "cluster-1",
    stable_key: "topic-cluster:1",
    cluster_version: "v1",
    rule_version: "topic-cluster-rules-v1",
    status: "active",
    slug: "dynamic-pgvector",
    display_name: "Dynamic Pgvector",
    summary: "dynamic cluster",
    keywords: ["pgvector", "postgres"],
    anchor_canonical_id: "stackoverflow:123",
    representative_evidence: [],
    source_mix: [],
    related_repos: ["pgvector/pgvector"],
    related_entities: ["pgvector"],
    item_count: 2,
    cluster_confidence: 0.92,
    runtime_fallback_reason: null,
    metadata: {},
    created_at: "2026-05-06T00:00:00.000Z",
    updated_at: "2026-05-06T00:10:00.000Z",
  });

  const runtimeTopics = await loadRuntimeTopics(state.pool, logger);

  assert.equal(runtimeTopics[0]?.slug, "dynamic-pgvector");
  assert.equal(runtimeTopics[0]?.sources[0], "topic-cluster");
});

test("loadRuntimeTopics falls back to active runtime seeds when cluster confidence is insufficient", async () => {
  const state = createStatefulPool();
  const logs: TestLogEntry[] = [];
  const logger = createTestLogger(logs);

  state.addRuntimeTopicSeed({
    run_id: "fallback-run",
    slug: "fallback-mcp",
    name: "Fallback MCP",
    keywords: ["mcp"],
    source_priority: 10,
    sources: ["fallback-topics"],
    collection_id: null,
    devto_tags: [],
    score: 10,
    active: true,
    refreshed_at: "2099-05-06T00:00:00.000Z",
    expires_at: "2099-05-06T02:00:00.000Z",
    metadata: {},
  });
  state.addTopicCluster({
    id: "cluster-row-2",
    topic_cluster_id: "cluster-2",
    stable_key: "topic-cluster:2",
    cluster_version: "v1",
    rule_version: "topic-cluster-rules-v1",
    status: "active",
    slug: "low-confidence-topic",
    display_name: "Low Confidence Topic",
    summary: "cluster summary",
    keywords: ["topic"],
    anchor_canonical_id: "devto:1",
    representative_evidence: [],
    source_mix: [],
    related_repos: [],
    related_entities: [],
    item_count: 1,
    cluster_confidence: 0.4,
    runtime_fallback_reason: "low-confidence",
    metadata: {},
    created_at: "2026-05-06T00:00:00.000Z",
    updated_at: "2026-05-06T00:10:00.000Z",
  });

  const runtimeTopics = await loadRuntimeTopics(state.pool, logger);

  assert.equal(runtimeTopics[0]?.slug, "fallback-mcp");
  assert.ok(
    logs.some(
      (entry) =>
        entry.event === "pipeline.runtime-topics.load.fallback" &&
        entry.context.fallbackReason === "low-confidence",
    ),
  );
});

test("runTopicClusteringBackfillJob reuses the clustering path for historical batches", async () => {
  const state = createStatefulPool();

  await persistCollectedPayloads(state.pool, [
    buildCollectedPayload("stackoverflow", "hot", [
      {
        title: "How do I keep MCP topic clustering stable across reruns?",
        score: 22,
        answers: 2,
        url: "https://stackoverflow.com/questions/10000004/mcp-topic-clustering-stability",
      },
    ]),
  ]);

  await runIncrementalEmbeddingJob(
    state.pool,
    {
      baseUrl: "http://127.0.0.1:11434",
      model: "nomic-embed-text-v2-moe",
      dimensions: 3,
      timeoutMs: 1000,
    },
    { limit: 10 },
    createTestLogger([]),
    async () => [0.75, 0.2, 0.05],
  );

  const result = await runTopicClusteringBackfillJob(
    state.pool,
    {
      baseUrl: "http://127.0.0.1:11434",
      model: "nomic-embed-text-v2-moe",
      dimensions: 3,
      timeoutMs: 1000,
    },
    { limit: 10 },
    createTestLogger([]),
  );

  assert.equal(result.embeddings, 1);
  assert.equal(result.clusters >= 1, true);
});
