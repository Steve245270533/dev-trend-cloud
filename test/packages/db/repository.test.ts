import assert from "node:assert/strict";
import test from "node:test";
import {
  getUnifiedModelCompatibilityReport,
  getWorkerBootstrapState,
  listActiveRuntimeTopicSeeds,
  listFeed,
  listQuestionPressureSignals,
  listUnifiedContentRecords,
  replaceRuntimeTopicSeeds,
  replaceSourceItems,
  rollbackUnifiedContentBySources,
  upsertUnifiedContentRecords,
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

test("upsertUnifiedContentRecords persists unified model payload", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  await upsertUnifiedContentRecords(db, [
    {
      canonicalId: "stackoverflow:123",
      source: "stackoverflow",
      sourceItemId: "123",
      title: "How to use MCP with Fastify",
      summary: "Question summary",
      bodyExcerpt: "Question body excerpt",
      url: "https://stackoverflow.com/questions/123",
      author: "alice",
      publishedAt: "2026-05-06T00:00:00.000Z",
      collectedAt: "2026-05-06T00:01:00.000Z",
      timestampOrigin: "source",
      tags: ["fastify", "mcp"],
      sourceFeatures: {
        shared: {
          score: 42,
          answerCount: 2,
          commentCount: 1,
        },
        stackoverflow: {
          answerCount: 2,
          commentCount: 1,
          viewCount: 100,
          hasAcceptedAnswer: false,
        },
      },
      fingerprint: "fastify-mcp-123",
      evidenceRefs: ["https://stackoverflow.com/questions/123"],
      legacyRefs: {
        itemId: "11111111-1111-5111-8111-111111111111",
        itemSourceId: "22222222-2222-5222-8222-222222222222",
      },
      rawMeta: {
        source: "stackoverflow",
      },
    },
  ]);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO unified_contents/);
  assert.match(
    calls[0].text,
    /ON CONFLICT \(source, source_item_id\) DO UPDATE/,
  );
  assert.equal(calls[0].params?.[0], "stackoverflow:123");
  assert.equal(calls[0].params?.[1], "stackoverflow");
  assert.equal(calls[0].params?.[2], "123");
});

test("listUnifiedContentRecords maps rows into unified records", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [
          {
            canonical_id: "devto:post-1",
            source: "devto",
            source_item_id: "post-1",
            title: "Dev.to post",
            summary: "summary",
            body_excerpt: null,
            url: "https://dev.to/example",
            author: "bob",
            published_at: "2026-05-06T00:00:00.000Z",
            collected_at: "2026-05-06T00:10:00.000Z",
            timestamp_origin: "collected",
            tags: ["devto"],
            source_features: { shared: {}, devto: { reactionsCount: 10 } },
            fingerprint: "devto-post-1",
            evidence_refs: ["https://dev.to/example"],
            legacy_item_id: "33333333-3333-5333-8333-333333333333",
            legacy_item_source_id: null,
            raw_meta: { from: "test" },
          },
        ],
      } as unknown as QueryResult;
    },
  };

  const records = await listUnifiedContentRecords(db, {
    source: "devto",
    limit: 5,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /FROM unified_contents/);
  assert.deepEqual(calls[0].params, ["devto", 5]);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.canonicalId, "devto:post-1");
  assert.equal(records[0]?.timestampOrigin, "collected");
});

test("getUnifiedModelCompatibilityReport aggregates compatibility violations", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [
          {
            legacy_item_missing_count: 1,
            legacy_item_source_missing_count: 2,
            source_mismatch_count: 3,
            source_item_id_mismatch_count: 4,
          },
        ],
      } as unknown as QueryResult;
    },
  };

  const report = await getUnifiedModelCompatibilityReport(db);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /COUNT\(\*\) FILTER/);
  assert.equal(report.legacyItemMissingCount, 1);
  assert.equal(report.legacyItemSourceMissingCount, 2);
  assert.equal(report.sourceMismatchCount, 3);
  assert.equal(report.sourceItemIdMismatchCount, 4);
});

test("rollbackUnifiedContentBySources deletes only requested sources", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [{ canonical_id: "devto:1" }, { canonical_id: "devto:2" }],
      } as unknown as QueryResult;
    },
  };

  const deletedCount = await rollbackUnifiedContentBySources(db, ["devto"]);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /DELETE FROM unified_contents/);
  assert.deepEqual(calls[0].params, [["devto"]]);
  assert.equal(deletedCount, 2);
});
