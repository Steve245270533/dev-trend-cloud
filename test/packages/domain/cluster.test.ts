import assert from "node:assert/strict";
import test from "node:test";
import {
  clusterTopicContents,
  entitySeeds,
  topicSeeds,
} from "@devtrend/domain";
import type {
  MatchedEntity,
  MatchedTopic,
  NormalizedItem,
} from "../../../packages/contracts/src/index.js";
import { clusterQuestionItems } from "../../../packages/domain/src/questions/cluster.js";
import {
  type EnrichedItem,
  extractQuestionFeatures,
} from "../../../packages/domain/src/questions/extract.js";

function buildTopic(slug: string): MatchedTopic {
  const seed = topicSeeds.find((topic) => topic.slug === slug);
  assert.ok(seed, `missing topic seed for ${slug}`);
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    confidence: 0.8,
    matchedKeywords: [seed.keywords[0] ?? seed.slug],
  };
}

function buildEntity(slug: string): MatchedEntity {
  const seed = entitySeeds.find((entity) => entity.slug === slug);
  assert.ok(seed, `missing entity seed for ${slug}`);
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    entityType: seed.entityType,
    confidence: 0.85,
    matchedKeywords: [seed.aliases[0] ?? seed.slug],
    repoName: seed.repos[0],
  };
}

function buildNormalizedItem(
  source: NormalizedItem["source"],
  title: string,
  overrides: Partial<NormalizedItem> = {},
): NormalizedItem {
  return {
    id: `${source}-${title}`.replaceAll(/[^a-z0-9-]/gi, "").padEnd(32, "0"),
    source,
    sourceItemId: `${source}:${title}`,
    title,
    summary: "",
    url: `https://example.com/${source}/${encodeURIComponent(title)}`,
    publishedAt: "2026-04-29T00:00:00.000Z",
    collectedAt: "2026-04-29T00:05:00.000Z",
    timestampOrigin: "source",
    score: 10,
    answerCount: 0,
    commentCount: 5,
    tags: [],
    contentType:
      source === "devto" ? "tag" : source === "hackernews" ? "ask" : "search",
    isQuestion: true,
    rawMeta: {},
    ...overrides,
  };
}

function buildEnrichedItem(
  source: NormalizedItem["source"],
  title: string,
  topicSlugs: string[],
  entitySlugs: string[],
  overrides: Partial<NormalizedItem> = {},
): EnrichedItem {
  const item = buildNormalizedItem(source, title, overrides);
  const topics = topicSlugs.map((slug) => buildTopic(slug));
  const entities = entitySlugs.map((slug) => buildEntity(slug));

  return {
    item,
    topics,
    entities,
    question: extractQuestionFeatures(item, topics, entities),
  };
}

test("clusters near-duplicate questions across sources", () => {
  const items = [
    buildEnrichedItem(
      "stackoverflow",
      "How to implement tool calling schema validation with MCP?",
      ["tool-calling", "mcp"],
      ["mcp-protocol"],
    ),
    buildEnrichedItem(
      "hackernews",
      "Ask HN: How are you validating MCP tool calling schemas?",
      ["tool-calling", "mcp"],
      ["mcp-protocol"],
    ),
    buildEnrichedItem(
      "devto",
      "How are teams validating MCP tool calling schemas?",
      ["tool-calling", "mcp"],
      ["mcp-protocol"],
    ),
  ];

  const clusters = clusterQuestionItems(items);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.cluster.evidenceCount, 3);
  assert.deepEqual(
    Object.keys(clusters[0]?.cluster.sourceDistribution ?? {}).sort(),
    ["devto", "hackernews", "stackoverflow"],
  );
});

test("does not merge generic title overlap without topic or entity anchors", () => {
  const items = [
    buildEnrichedItem(
      "stackoverflow",
      "How do teams scale workflow automation in production?",
      ["orchestration"],
      [],
    ),
    buildEnrichedItem(
      "hackernews",
      "How do teams scale API documentation in production?",
      ["docs-quality"],
      [],
    ),
  ];

  const clusters = clusterQuestionItems(items);

  assert.equal(clusters.length, 2);
});

test("cluster ids stay stable across repeated runs", () => {
  const items = [
    buildEnrichedItem(
      "devto",
      "Why is pgvector returning unstable similarity search results for RAG?",
      ["postgres", "rag"],
      ["pgvector", "postgresql"],
      {
        publishedAt: "2026-04-28T14:30:00.000Z",
      },
    ),
    buildEnrichedItem(
      "hackernews",
      "Why does pgvector similarity search keep returning unstable results?",
      ["postgres"],
      ["pgvector"],
    ),
    buildEnrichedItem(
      "stackoverflow",
      "Why does vector similarity search return unstable results in pgvector?",
      ["postgres"],
      ["pgvector"],
    ),
  ];

  const firstRun = clusterQuestionItems(items);
  const secondRun = clusterQuestionItems([...items].reverse());

  assert.deepEqual(
    firstRun.map((cluster) => cluster.cluster.clusterId).sort(),
    secondRun.map((cluster) => cluster.cluster.clusterId).sort(),
  );
});

test("clusters related questions when entity anchors and significant title tokens overlap", () => {
  const items = [
    buildEnrichedItem(
      "stackoverflow",
      "How to pass data from an MCP client to an MCP server in Java?",
      ["mcp"],
      ["mcp-protocol"],
    ),
    buildEnrichedItem(
      "hackernews",
      "Ask HN: What MCP servers/apps are you using as a dev?",
      ["mcp"],
      ["mcp-protocol"],
    ),
    buildEnrichedItem(
      "devto",
      "Why we built an MCP server for website health data",
      ["mcp"],
      ["mcp-protocol"],
    ),
  ];

  const clusters = clusterQuestionItems(items);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.cluster.evidenceCount, 3);
});

test("Tell HN titles do not become question evidence unless they are actual questions", () => {
  const tellCluster = clusterQuestionItems([
    buildEnrichedItem(
      "hackernews",
      "Tell HN: One Medical Is a Nightmare",
      ["docs-quality"],
      [],
      {
        isQuestion: false,
      },
    ),
    buildEnrichedItem(
      "hackernews",
      "Ask HN: Why is MCP tool calling so brittle in production?",
      ["mcp"],
      ["mcp-protocol"],
    ),
  ]);

  assert.equal(tellCluster.length, 1);
  assert.equal(
    tellCluster[0]?.cluster.canonicalQuestion,
    "Ask HN: Why is MCP tool calling so brittle in production?",
  );
});

function buildTopicContentInput(input: {
  canonicalId: string;
  source: "stackoverflow" | "hackernews" | "devto" | "ossinsight";
  title: string;
  summary: string;
  tags: string[];
  vector: number[];
  publishedAt?: string;
  rawMeta?: Record<string, unknown>;
}) {
  return {
    embeddingId: `${input.canonicalId}-embedding-id`.padEnd(36, "0"),
    vector: input.vector,
    content: {
      canonicalId: input.canonicalId,
      source: input.source,
      sourceItemId: input.canonicalId.split(":")[1] ?? input.canonicalId,
      title: input.title,
      summary: input.summary,
      bodyExcerpt: input.summary,
      url: `https://example.com/${encodeURIComponent(input.canonicalId)}`,
      publishedAt: input.publishedAt ?? "2026-05-06T00:00:00.000Z",
      collectedAt: "2026-05-06T00:05:00.000Z",
      timestampOrigin: "source" as const,
      tags: input.tags,
      sourceFeatures: {
        shared: {
          score: 10,
        },
      },
      fingerprint: `${input.canonicalId}-fp`,
      evidenceRefs: [],
      legacyRefs: {
        itemId: "11111111-1111-5111-8111-111111111111",
        itemSourceId: null,
      },
      rawMeta: input.rawMeta ?? {},
    },
  };
}

test("topic clustering merges cross-source content with repo/entity guardrails", () => {
  const clusters = clusterTopicContents([
    buildTopicContentInput({
      canonicalId: "stackoverflow:pgvector-1",
      source: "stackoverflow",
      title: "Why does pgvector return unstable similarity results?",
      summary: "pgvector and postgres ranking drift across reruns",
      tags: ["pgvector", "postgres", "rag"],
      vector: [0.93, 0.07, 0.01],
      rawMeta: {
        repo: "pgvector/pgvector",
        entitySlugs: ["pgvector"],
      },
    }),
    buildTopicContentInput({
      canonicalId: "devto:pgvector-2",
      source: "devto",
      title: "Why pgvector ranking feels unstable in production RAG",
      summary: "Teams compare pgvector recall and postgres query planning",
      tags: ["pgvector", "postgres"],
      vector: [0.92, 0.06, 0.02],
      rawMeta: {
        repo: "pgvector/pgvector",
        entitySlugs: ["pgvector"],
      },
    }),
    buildTopicContentInput({
      canonicalId: "ossinsight:pgvector-3",
      source: "ossinsight",
      title: "Pgvector adoption keeps rising with Postgres AI workflows",
      summary: "OSSInsight proxy data highlights pgvector usage and activity",
      tags: ["pgvector", "postgres", "vector"],
      vector: [0.91, 0.08, 0.01],
      rawMeta: {
        repo: "pgvector/pgvector",
        entitySlugs: ["pgvector"],
      },
    }),
  ]);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.cluster.itemCount, 3);
  assert.equal(clusters[0]?.cluster.sourceMix.length, 3);
  assert.equal(clusters[0]?.cluster.relatedRepos[0], "pgvector pgvector");
  assert.equal(
    clusters[0]?.cluster.representativeEvidence.some(
      (evidence) => evidence.role === "primary",
    ),
    true,
  );
});

test("topic clustering rejects merge when repo anchors conflict despite similar vectors", () => {
  const clusters = clusterTopicContents([
    buildTopicContentInput({
      canonicalId: "stackoverflow:fastify-1",
      source: "stackoverflow",
      title: "How do teams debug Fastify MCP schemas?",
      summary: "Fastify plugins and schema validation around MCP tool calls",
      tags: ["fastify", "mcp"],
      vector: [0.88, 0.1, 0.02],
      rawMeta: {
        repo: "fastify/fastify",
        entitySlugs: ["fastify"],
      },
    }),
    buildTopicContentInput({
      canonicalId: "devto:express-2",
      source: "devto",
      title: "How do teams debug Express MCP schemas?",
      summary: "Express middleware and schema validation around MCP tool calls",
      tags: ["express", "mcp"],
      vector: [0.87, 0.11, 0.02],
      rawMeta: {
        repo: "expressjs/express",
        entitySlugs: ["express"],
      },
    }),
  ]);

  assert.equal(clusters.length, 2);
});

test("topic clustering keeps stable ids across repeated runs", () => {
  const inputs = [
    buildTopicContentInput({
      canonicalId: "hackernews:mcp-1",
      source: "hackernews",
      title: "Ask HN: What MCP servers are you deploying?",
      summary: "MCP servers, tool calling and deployment stories",
      tags: ["mcp", "tool-calling"],
      vector: [0.75, 0.21, 0.04],
      rawMeta: {
        entitySlugs: ["mcp-protocol"],
      },
    }),
    buildTopicContentInput({
      canonicalId: "devto:mcp-2",
      source: "devto",
      title: "Shipping MCP servers with deterministic tool contracts",
      summary: "MCP protocol rollout and tool calling guardrails",
      tags: ["mcp", "contracts"],
      vector: [0.76, 0.2, 0.04],
      rawMeta: {
        entitySlugs: ["mcp-protocol"],
      },
    }),
  ];

  const firstRun = clusterTopicContents(inputs);
  const secondRun = clusterTopicContents([...inputs].reverse());

  assert.deepEqual(
    firstRun.map((cluster) => cluster.cluster.topicClusterId),
    secondRun.map((cluster) => cluster.cluster.topicClusterId),
  );
});

test("topic clustering keeps cluster id stable when membership changes", () => {
  const baseInputs = [
    buildTopicContentInput({
      canonicalId: "stackoverflow:pgvector-anchor",
      source: "stackoverflow",
      title: "How to stabilize pgvector ranking for production RAG workloads?",
      summary: "pgvector ranking drifts and postgres tuning strategies",
      tags: ["pgvector", "postgres", "rag"],
      vector: [0.93, 0.06, 0.01],
      rawMeta: {
        repo: "pgvector/pgvector",
        entitySlugs: ["pgvector"],
      },
    }),
    buildTopicContentInput({
      canonicalId: "devto:pgvector-neighbor",
      source: "devto",
      title: "Stabilizing pgvector relevance in production",
      summary: "shared pgvector recall issues and postgres query planning",
      tags: ["pgvector", "postgres"],
      vector: [0.92, 0.07, 0.01],
      rawMeta: {
        repo: "pgvector/pgvector",
        entitySlugs: ["pgvector"],
      },
    }),
  ];

  const expandedInputs = [
    ...baseInputs,
    buildTopicContentInput({
      canonicalId: "ossinsight:pgvector-third",
      source: "ossinsight",
      title: "Pgvector adoption and operational tuning trends",
      summary: "ecosystem signals for pgvector and postgres AI workloads",
      tags: ["pgvector", "postgres", "vector"],
      vector: [0.91, 0.08, 0.01],
      rawMeta: {
        repo: "pgvector/pgvector",
        entitySlugs: ["pgvector"],
      },
    }),
  ];

  const baseCluster = clusterTopicContents(baseInputs)[0]?.cluster;
  const expandedCluster = clusterTopicContents(expandedInputs)[0]?.cluster;

  assert.ok(baseCluster);
  assert.ok(expandedCluster);
  assert.equal(baseCluster?.topicClusterId, expandedCluster?.topicClusterId);
  assert.notEqual(baseCluster?.clusterVersion, expandedCluster?.clusterVersion);
});
