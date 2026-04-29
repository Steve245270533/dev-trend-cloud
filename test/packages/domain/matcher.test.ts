import assert from "node:assert/strict";
import test from "node:test";
import type { NormalizedItem } from "../../../packages/contracts/src/index.js";
import {
  buildMatchContext,
  matchCatalog,
  matchesKeyword,
} from "../../../packages/domain/src/matching/matcher.js";

function buildItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: "11111111-1111-5111-8111-111111111111",
    source: "stackoverflow",
    sourceItemId: "seed-item",
    title: "Untitled",
    summary: "",
    url: "https://example.com/item",
    publishedAt: "2026-04-29T00:00:00.000Z",
    collectedAt: "2026-04-29T00:05:00.000Z",
    timestampOrigin: "source",
    score: 1,
    answerCount: 0,
    commentCount: 0,
    tags: [],
    contentType: "search",
    isQuestion: true,
    rawMeta: {},
    ...overrides,
  };
}

test("short keywords only match structured exact context", () => {
  const freeTextContext = buildMatchContext(
    buildItem({
      title: "Why do AI workflows break in production DB migrations?",
    }),
  );

  assert.equal(matchesKeyword(freeTextContext, "ai"), false);
  assert.equal(matchesKeyword(freeTextContext, "db"), false);
  assert.equal(matchesKeyword(freeTextContext, "ts"), false);

  const structuredContext = buildMatchContext(
    buildItem({
      tags: ["ai", "db", "ts"],
      rawMeta: { language: "ts" },
    }),
  );

  assert.equal(matchesKeyword(structuredContext, "ai"), true);
  assert.equal(matchesKeyword(structuredContext, "db"), true);
  assert.equal(matchesKeyword(structuredContext, "ts"), true);
});

test("substring matches no longer misclassify TypeScript topics", () => {
  const result = matchCatalog(
    buildItem({
      title:
        "Why does vector similarity search return unstable results in pgvector?",
      url: "https://stackoverflow.com/questions/10000005/pgvector-similarity",
      rawMeta: {
        title:
          "Why does vector similarity search return unstable results in pgvector?",
      },
    }),
  );

  assert.deepEqual(result.topics.map((topic) => topic.slug).sort(), [
    "postgres",
  ]);
  assert.equal(
    result.topics.some((topic) => topic.slug === "typescript"),
    false,
  );
});

test("full keywords and repo-aware structured matches still work", () => {
  const result = matchCatalog(
    buildItem({
      source: "devto",
      sourceItemId: "langchain-ai/langchain",
      title: "TypeScript and SWC patterns for MCP clients",
      summary: "langchain-ai/langchain field guide",
      url: "https://github.com/langchain-ai/langchain",
      tags: ["typescript", "mcp"],
      rawMeta: {
        repo_name: "langchain-ai/langchain",
        language: "TypeScript",
      },
      contentType: "tag",
    }),
  );

  const topicSlugs = result.topics.map((topic) => topic.slug);
  const entitySlugs = result.entities.map((entity) => entity.slug);

  assert.equal(topicSlugs.includes("typescript"), true);
  assert.equal(topicSlugs.includes("mcp"), true);
  assert.equal(entitySlugs.includes("langchain"), true);
  assert.equal(entitySlugs.includes("mcp-protocol"), true);
});
