import assert from "node:assert/strict";
import test from "node:test";
import type { CollectedSourcePayload } from "@devtrend/sources";
import {
  loadRuntimeTopics,
  persistCollectedPayloads,
  planWorkerBootstrap,
  refreshRuntimeTopicSeeds,
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
  assert.equal(state.sourceHealth[0]?.status, "failed");
  assert.equal(state.sourceHealth[0]?.fallback_used, false);
  assert.equal(state.items.length, 0);
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
