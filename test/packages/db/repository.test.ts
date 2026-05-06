import assert from "node:assert/strict";
import test from "node:test";
import {
  getUnifiedModelCompatibilityReport,
  getWorkerBootstrapState,
  listActiveRuntimeTopicSeeds,
  listActiveTopicClusters,
  listEmbeddingBackfillCandidates,
  listEmbeddingRecords,
  listFeed,
  listQuestionPressureSignals,
  listRuntimeTopicClusterSeeds,
  listTopicClusterMemberships,
  listUnifiedContentRecords,
  markSupersededEmbeddings,
  markSupersededTopicClusters,
  replaceRuntimeTopicSeeds,
  replaceSourceItems,
  replaceTopicClusterMemberships,
  rollbackUnifiedContentBySources,
  updateEmbeddingRecordStatus,
  upsertEmbeddingRecord,
  upsertTopicCluster,
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

test("upsertEmbeddingRecord supersedes stale records and upserts by dedupe key", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      if (text.includes("RETURNING id")) {
        return { rows: [{ id: "44444444-4444-5444-8444-444444444444" }] };
      }
      return { rows: [] };
    },
  };

  const id = await upsertEmbeddingRecord(db as never, {
    canonicalId: "stackoverflow:123",
    source: "stackoverflow",
    contentFingerprint: "fp-v2",
    inputSchemaVersion: "embedding-input-v1",
    provider: "ollama",
    model: "nomic-embed-text-v2-moe",
    modelVersion: "2026-05-06",
    vector: [0.1, 0.2, 0.3],
    metadata: { traceId: "trace-1" },
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? "", /UPDATE embedding_records/);
  assert.match(calls[0]?.text ?? "", /status = 'superseded'/);
  assert.deepEqual(calls[0]?.params, [
    "stackoverflow:123",
    "stackoverflow",
    "nomic-embed-text-v2-moe",
    "embedding-input-v1",
    "fp-v2",
  ]);
  assert.match(calls[1]?.text ?? "", /INSERT INTO embedding_records/);
  assert.match(
    calls[1]?.text ?? "",
    /ON CONFLICT \(source, content_fingerprint, model, input_schema_version\)/,
  );
  assert.equal(calls[1]?.params?.[8], "[0.1,0.2,0.3]");
  assert.equal(id, "44444444-4444-5444-8444-444444444444");
});

test("listEmbeddingRecords maps vector text and query filters", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [
          {
            id: "55555555-5555-5555-8555-555555555555",
            canonical_id: "devto:post-1",
            source: "devto",
            content_fingerprint: "fp-devto-1",
            input_schema_version: "embedding-input-v1",
            provider: "ollama",
            model: "nomic-embed-text-v2-moe",
            model_version: "2026-05-06",
            dimensions: 3,
            embedding_vector_text: "[1,2,3]",
            status: "succeeded",
            error_text: null,
            retry_count: 0,
            metadata: { region: "local" },
            created_at: "2026-05-06T00:00:00.000Z",
            updated_at: "2026-05-06T00:10:00.000Z",
            succeeded_at: "2026-05-06T00:10:01.000Z",
          },
        ],
      } as unknown as QueryResult;
    },
  };

  const records = await listEmbeddingRecords(db, {
    source: "devto",
    model: "nomic-embed-text-v2-moe",
    status: "succeeded",
    limit: 5,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /FROM embedding_records/);
  assert.deepEqual(calls[0]?.params, [
    null,
    "devto",
    "nomic-embed-text-v2-moe",
    "succeeded",
    5,
  ]);
  assert.equal(records[0]?.canonicalId, "devto:post-1");
  assert.deepEqual(records[0]?.vector, [1, 2, 3]);
});

test("listEmbeddingBackfillCandidates supports includeFailed mode", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [
          {
            canonical_id: "stackoverflow:123",
            source: "stackoverflow",
            fingerprint: "fp-v2",
            collected_at: "2026-05-06T01:00:00.000Z",
          },
        ],
      } as unknown as QueryResult;
    },
  };

  const candidates = await listEmbeddingBackfillCandidates(db, {
    source: "stackoverflow",
    model: "nomic-embed-text-v2-moe",
    inputSchemaVersion: "embedding-input-v1",
    includeFailed: true,
    limit: 20,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /LEFT JOIN embedding_records er/);
  assert.deepEqual(calls[0]?.params, [
    "stackoverflow",
    "nomic-embed-text-v2-moe",
    "embedding-input-v1",
    ["failed"],
    20,
  ]);
  assert.equal(candidates[0]?.canonicalId, "stackoverflow:123");
  assert.equal(candidates[0]?.contentFingerprint, "fp-v2");
});

test("updateEmbeddingRecordStatus updates retry and failure info", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [{ id: "66666666-6666-5666-8666-666666666666" }],
      } as unknown as QueryResult;
    },
  };

  const updated = await updateEmbeddingRecordStatus(db, {
    id: "66666666-6666-5666-8666-666666666666",
    status: "failed",
    errorText: "timeout",
    retryCount: 2,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /UPDATE embedding_records/);
  assert.deepEqual(calls[0]?.params, [
    "66666666-6666-5666-8666-666666666666",
    "failed",
    "timeout",
    2,
  ]);
  assert.equal(updated, true);
});

test("markSupersededEmbeddings applies dedupe superseded rule", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [{ id: "a" }, { id: "b" }],
      } as unknown as QueryResult;
    },
  };

  const count = await markSupersededEmbeddings(db, {
    canonicalId: "hackernews:1",
    source: "hackernews",
    model: "nomic-embed-text-v2-moe",
    inputSchemaVersion: "embedding-input-v1",
    keepFingerprint: "fp-latest",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /status = 'superseded'/);
  assert.deepEqual(calls[0]?.params, [
    "hackernews:1",
    "hackernews",
    "nomic-embed-text-v2-moe",
    "embedding-input-v1",
    "fp-latest",
  ]);
  assert.equal(count, 2);
});

test("upsertTopicCluster persists versioned cluster payload", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return {
        rows: [
          {
            id: "77777777-7777-5777-8777-777777777777",
            topic_cluster_id: "88888888-8888-5888-8888-888888888888",
            stable_key: "topic-cluster:abc",
            cluster_version: "v1",
            rule_version: "topic-cluster-rules-v1",
            status: "active",
            slug: "pgvector-postgres-rag",
            display_name: "Pgvector Postgres Rag",
            summary: "cluster summary",
            keywords: ["pgvector", "postgres"],
            anchor_canonical_id: "stackoverflow:123",
            representative_evidence: [],
            source_mix: [],
            related_repos: ["pgvector/pgvector"],
            related_entities: ["pgvector"],
            item_count: 3,
            cluster_confidence: 0.91,
            runtime_fallback_reason: null,
            metadata: {},
            created_at: "2026-05-06T00:00:00.000Z",
            updated_at: "2026-05-06T00:10:00.000Z",
          },
        ],
      } as unknown as QueryResult;
    },
  };

  const cluster = await upsertTopicCluster(db, {
    topicClusterId: "88888888-8888-5888-8888-888888888888",
    stableKey: "topic-cluster:abc",
    clusterVersion: "v1",
    ruleVersion: "topic-cluster-rules-v1",
    status: "active",
    slug: "pgvector-postgres-rag",
    displayName: "Pgvector Postgres Rag",
    summary: "cluster summary",
    keywords: ["pgvector", "postgres"],
    anchorCanonicalId: "stackoverflow:123",
    representativeEvidence: [],
    sourceMix: [],
    relatedRepos: ["pgvector/pgvector"],
    relatedEntities: ["pgvector"],
    itemCount: 3,
    clusterConfidence: 0.91,
    metadata: {},
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /INSERT INTO topic_clusters/);
  assert.match(
    calls[0]?.text ?? "",
    /ON CONFLICT \(topic_cluster_id, cluster_version\) DO UPDATE/,
  );
  assert.equal(cluster.rowId, "77777777-7777-5777-8777-777777777777");
  assert.equal(cluster.topicClusterId, "88888888-8888-5888-8888-888888888888");
});

test("replaceTopicClusterMemberships rewrites active memberships", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  const written = await replaceTopicClusterMemberships(db, {
    topicClusterRowId: "77777777-7777-5777-8777-777777777777",
    memberships: [
      {
        topicClusterId: "88888888-8888-5888-8888-888888888888",
        clusterVersion: "v1",
        canonicalId: "stackoverflow:123",
        itemId: "11111111-1111-5111-8111-111111111111",
        embeddingRecordId: "22222222-2222-5222-8222-222222222222",
        source: "stackoverflow",
        membershipConfidence: 0.95,
        primaryEvidence: true,
        evidenceRank: 1,
        reasoningTags: ["cluster-anchor"],
        metadata: {},
      },
    ],
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? "", /DELETE FROM topic_cluster_memberships/);
  assert.match(calls[1]?.text ?? "", /INSERT INTO topic_cluster_memberships/);
  assert.equal(written, 1);
});

test("listActiveTopicClusters and memberships map persisted topic cluster rows", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      if (text.includes("FROM topic_clusters")) {
        return {
          rows: [
            {
              id: "77777777-7777-5777-8777-777777777777",
              topic_cluster_id: "88888888-8888-5888-8888-888888888888",
              stable_key: "topic-cluster:abc",
              cluster_version: "v1",
              rule_version: "topic-cluster-rules-v1",
              status: "active",
              slug: "mcp-tool-calling",
              display_name: "Mcp Tool Calling",
              summary: "cluster summary",
              keywords: ["mcp", "tool-calling"],
              anchor_canonical_id: "hackernews:1",
              representative_evidence: [],
              source_mix: [{ source: "hackernews", count: 1, ratio: 1 }],
              related_repos: [],
              related_entities: ["mcp-protocol"],
              item_count: 1,
              cluster_confidence: 0.82,
              runtime_fallback_reason: null,
              metadata: {},
              created_at: "2026-05-06T00:00:00.000Z",
              updated_at: "2026-05-06T00:10:00.000Z",
            },
          ],
        } as unknown as QueryResult;
      }

      return {
        rows: [
          {
            topic_cluster_id: "88888888-8888-5888-8888-888888888888",
            cluster_version: "v1",
            canonical_id: "hackernews:1",
            item_id: "11111111-1111-5111-8111-111111111111",
            embedding_record_id: null,
            source: "hackernews",
            membership_confidence: 1,
            primary_evidence: true,
            evidence_rank: 1,
            reasoning_tags: ["cluster-anchor"],
            metadata: {},
          },
        ],
      } as unknown as QueryResult;
    },
  };

  const clusters = await listActiveTopicClusters(db, { limit: 10 });
  const memberships = await listTopicClusterMemberships(
    db,
    "88888888-8888-5888-8888-888888888888",
  );

  assert.equal(calls.length, 2);
  assert.equal(clusters[0]?.slug, "mcp-tool-calling");
  assert.equal(memberships[0]?.canonicalId, "hackernews:1");
});

test("markSupersededTopicClusters updates old active rows", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [{ id: "old-1" }] } as unknown as QueryResult;
    },
  };

  const count = await markSupersededTopicClusters(db, {
    ruleVersion: "topic-cluster-rules-v1",
    keepTopicClusterIds: ["88888888-8888-5888-8888-888888888888"],
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? "", /UPDATE topic_clusters/);
  assert.deepEqual(calls[0]?.params, [
    "topic-cluster-rules-v1",
    ["88888888-8888-5888-8888-888888888888"],
  ]);
  assert.equal(count, 1);
});

test("listRuntimeTopicClusterSeeds projects active clusters into runtime topics", async () => {
  const db = {
    async query() {
      return {
        rows: [
          {
            id: "77777777-7777-5777-8777-777777777777",
            topic_cluster_id: "88888888-8888-5888-8888-888888888888",
            stable_key: "topic-cluster:abc",
            cluster_version: "v1",
            rule_version: "topic-cluster-rules-v1",
            status: "active",
            slug: "pgvector-postgres-rag",
            display_name: "Pgvector Postgres Rag",
            summary: "cluster summary",
            keywords: ["pgvector", "postgres"],
            anchor_canonical_id: "stackoverflow:123",
            representative_evidence: [],
            source_mix: [],
            related_repos: ["pgvector/pgvector"],
            related_entities: ["pgvector"],
            item_count: 3,
            cluster_confidence: 0.91,
            runtime_fallback_reason: null,
            metadata: {},
            created_at: "2026-05-06T00:00:00.000Z",
            updated_at: "2026-05-06T00:10:00.000Z",
          },
        ],
      } as unknown as QueryResult;
    },
  };

  const seeds = await listRuntimeTopicClusterSeeds(db, 10);

  assert.equal(seeds.length, 1);
  assert.equal(seeds[0]?.sources[0], "topic-cluster");
  assert.equal(seeds[0]?.slug, "pgvector-postgres-rag");
});
