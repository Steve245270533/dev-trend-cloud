import assert from "node:assert/strict";
import test from "node:test";
import { entitySeeds, topicSeeds } from "@devtrend/domain";
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
