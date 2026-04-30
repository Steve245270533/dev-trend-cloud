import assert from "node:assert/strict";
import test from "node:test";
import {
  getWorkerBootstrapState,
  listActiveRuntimeTopicSeeds,
  listFeed,
  listQuestionPressureSignals,
  replaceRuntimeTopicSeeds,
  replaceSourceItems,
} from "@devtrend/db";
import type { QueryResult } from "pg";

test("listFeed pushes topic and entity filters into SQL before LIMIT", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  await listFeed(db, {
    topic: "mcp",
    entity: "fastify",
    source: "stackoverflow",
    limit: 5,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /EXISTS\s*\(\s*SELECT 1\s*FROM item_topics/);
  assert.match(calls[0].text, /EXISTS\s*\(\s*SELECT 1\s*FROM item_entities/);
  assert.deepEqual(calls[0].params, ["stackoverflow", "mcp", "fastify", 5]);
});

test("listQuestionPressureSignals filters in SQL before LIMIT", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  await listQuestionPressureSignals(db, {
    topic: "mcp",
    entity: "fastify",
    limit: 10,
  });

  assert.equal(calls.length, 1);
  assert.match(
    calls[0].text,
    /JOIN question_clusters qc ON qc\.id = s\.cluster_id/,
  );
  assert.match(calls[0].text, /\$1 = ANY\(qc\.affected_topics\)/);
  assert.match(calls[0].text, /\$2 = ANY\(qc\.affected_entities\)/);
  assert.deepEqual(calls[0].params, ["mcp", "fastify", 10]);
});

test("replaceSourceItems scopes replacement to the requested sources", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  await replaceSourceItems(
    db,
    {
      feed: [],
      signals: [],
      evidenceByClusterId: {},
    },
    ["devto"],
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /DELETE FROM items WHERE source = ANY/);
  assert.deepEqual(calls[0].params, [["devto"]]);
});

test("listActiveRuntimeTopicSeeds falls back to catalog topics when runtime snapshot is missing", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });

      if (text.includes("FROM runtime_topic_seeds")) {
        return { rows: [] } as unknown as QueryResult;
      }

      if (text.includes("FROM topics")) {
        return {
          rows: [
            {
              run_id: "00000000-0000-5000-8000-000000000000",
              slug: "mcp",
              name: "Model Context Protocol",
              keywords: ["mcp", "model context protocol"],
              source_priority: 10,
              sources: ["fallback-topics"],
              collection_id: null,
              devto_tags: [],
              score: 10,
              active: true,
              refreshed_at: "2026-04-29T00:00:00.000Z",
              expires_at: "2026-04-29T02:00:00.000Z",
              metadata: { fallback: true },
            },
          ],
        } as unknown as QueryResult;
      }

      throw new Error(`Unhandled query: ${text}`);
    },
  };

  const seeds = await listActiveRuntimeTopicSeeds(db);

  assert.equal(calls.length, 2);
  assert.equal(seeds[0]?.slug, "mcp");
  assert.equal(seeds[0]?.sources[0], "fallback-topics");
});

test("replaceRuntimeTopicSeeds deactivates the old snapshot before inserting the new one", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  await replaceRuntimeTopicSeeds(db, "11111111-1111-5111-8111-111111111111", [
    {
      runId: "11111111-1111-5111-8111-111111111111",
      slug: "artificial-intelligence",
      name: "Artificial Intelligence",
      keywords: ["artificial intelligence", "ai"],
      sourcePriority: 100,
      sources: ["ossinsight-hot"],
      collectionId: "10010",
      devtoTags: ["ai"],
      score: 104,
      active: true,
      refreshedAt: "2026-04-29T00:00:00.000Z",
      expiresAt: "2026-04-29T02:00:00.000Z",
      metadata: {},
    },
  ]);

  assert.match(
    calls[0]?.text ?? "",
    /UPDATE runtime_topic_seeds SET active = FALSE WHERE active = TRUE/,
  );
  assert.match(calls[1]?.text ?? "", /INSERT INTO runtime_topic_seeds/);
  assert.equal(calls[1]?.params?.[1], "artificial-intelligence");
});

test("getWorkerBootstrapState reports whether runtime topics and items are present", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });

      if (text.includes("FROM runtime_topic_seeds")) {
        return {
          rows: [{ has_active_runtime_topic_snapshot: true }],
        } as unknown as QueryResult;
      }

      if (text.includes("FROM items")) {
        return {
          rows: [{ has_persisted_items: false }],
        } as unknown as QueryResult;
      }

      throw new Error(`Unhandled query: ${text}`);
    },
  };

  const state = await getWorkerBootstrapState(db);

  assert.equal(calls.length, 2);
  assert.equal(state.hasActiveRuntimeTopicSnapshot, true);
  assert.equal(state.hasPersistedItems, false);
});
