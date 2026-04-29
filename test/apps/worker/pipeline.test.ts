import assert from "node:assert/strict";
import test from "node:test";
import { persistCollectedPayloads } from "@devtrend/worker";
import type { Pool, PoolClient, QueryResult } from "pg";

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
}

interface StatefulPool {
  executed: string[];
  items: FakeItemRow[];
  signalPayloads: Record<string, unknown>[];
  sourceRuns: number;
  rawSnapshots: number;
  pool: Pool;
}

function createStatefulPool(): StatefulPool {
  const executed: string[] = [];
  const items = new Map<string, FakeItemRow>();
  const sourceHealth = new Map<string, FakeSourceHealthRow>();
  let signalPayloads: Record<string, unknown>[] = [];
  let sourceRuns = 0;
  let rawSnapshots = 0;

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
        text.includes("INSERT INTO item_sources") ||
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

      if (text.includes("INSERT INTO source_runs")) {
        sourceRuns += 1;
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("INSERT INTO raw_snapshots")) {
        rawSnapshots += 1;
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("DELETE FROM items WHERE source = ANY")) {
        const sources = Array.isArray(params?.[0]) ? params[0].map(String) : [];

        for (const [key, item] of items.entries()) {
          if (sources.includes(item.source)) {
            items.delete(key);
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
        });
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("SELECT source, status, last_success_at")) {
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

      if (text.includes("SELECT i.*") && text.includes("FROM items i")) {
        return {
          rows: [...items.values()],
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
      {
        source: "stackoverflow",
        commandName: "hot",
        argv: ["stackoverflow", "hot", "--limit", "5", "-f", "json"],
        helpOutput: "usage",
        payload: [
          {
            title: "How do I debug Model Context Protocol tool registration?",
            score: 12,
            answers: 0,
            url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
          },
        ],
      },
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
  assert.ok(!executed.includes("COMMIT"));
});

test("persistCollectedPayloads keeps prior sources and rebuilds global signals", async () => {
  const state = createStatefulPool();

  await persistCollectedPayloads(state.pool, [
    {
      source: "stackoverflow",
      commandName: "hot",
      argv: ["stackoverflow", "hot", "--limit", "5", "-f", "json"],
      helpOutput: "usage",
      payload: [
        {
          title:
            "How do I debug Model Context Protocol tool registration in Fastify?",
          score: 12,
          answers: 0,
          url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
        },
      ],
    },
  ]);

  await persistCollectedPayloads(state.pool, [
    {
      source: "hackernews",
      commandName: "ask",
      argv: ["hackernews", "ask", "--limit", "5", "-f", "json"],
      helpOutput: "usage",
      payload: [
        {
          title:
            "How do I debug Model Context Protocol tool registration in Fastify?",
          score: 29,
          author: "bob",
          comments: 18,
        },
      ],
    },
  ]);

  assert.deepEqual(state.items.map((item) => item.source).sort(), [
    "hackernews",
    "stackoverflow",
  ]);
  assert.equal(state.sourceRuns, 2);
  assert.equal(state.rawSnapshots, 2);
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
