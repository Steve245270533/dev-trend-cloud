import assert from "node:assert/strict";
import test from "node:test";
import {
  isUnifiedContentRecord,
  isValidSourceFeatures,
} from "../../../packages/domain/src/index.js";

const validSourceFeatures = {
  shared: {
    score: 87,
    answerCount: 2,
    commentCount: 4,
    reactionCount: 10,
    viewCount: 200,
    trendScore: 0.73,
  },
  stackoverflow: {
    answerCount: 2,
    commentCount: 4,
    viewCount: 200,
    hasAcceptedAnswer: true,
  },
  hackernews: {
    points: 123,
    comments: 55,
    postKind: "ask",
  },
  devto: {
    readingTimeMinutes: 7,
    reactionsCount: 10,
    commentsCount: 3,
    tagDensity: 0.42,
    tutorialIntent: true,
  },
  ossinsight: {
    starsGrowth: 12.5,
    issueCreatorGrowth: 1.2,
    prCreatorGrowth: 0.8,
    collectionMembership: ["ai-tooling", "data-engineering"],
  },
};

test("source features validator accepts layered schema", () => {
  assert.equal(isValidSourceFeatures(validSourceFeatures), true);
});

test("source features validator rejects invalid extension values", () => {
  assert.equal(
    isValidSourceFeatures({
      ...validSourceFeatures,
      devto: {
        ...validSourceFeatures.devto,
        tagDensity: -1,
      },
    }),
    false,
  );
});

test("unified content validator accepts canonical records", () => {
  const record = {
    canonicalId: "cn_devto_123456",
    source: "devto",
    sourceItemId: "123456",
    title: "How teams harden MCP tool-calling contracts",
    summary: "A field report on contract drift and deterministic guardrails.",
    bodyExcerpt: "Teams should keep rule-first matching in the critical path.",
    url: "https://dev.to/example/post",
    author: "example-author",
    publishedAt: "2026-05-05T08:00:00.000Z",
    collectedAt: "2026-05-05T08:10:00.000Z",
    timestampOrigin: "source",
    tags: ["mcp", "contracts", "typescript"],
    sourceFeatures: validSourceFeatures,
    fingerprint:
      "sha256:0f3f6ee18f1f257f5f9d102dfe1234567890abcdef1234567890abcdef1234",
    evidenceRefs: ["https://dev.to/example/post#comments"],
    legacyRefs: {
      itemId: "11111111-1111-5111-8111-111111111111",
      itemSourceId: "22222222-2222-5222-8222-222222222222",
    },
    rawMeta: {
      language: "TypeScript",
    },
  };

  assert.equal(isUnifiedContentRecord(record), true);
});

test("unified content validator rejects non-layered feature payload", () => {
  const invalidRecord = {
    canonicalId: "cn_hn_123",
    source: "hackernews",
    sourceItemId: "123",
    title: "Ask HN: How to keep schema contracts stable?",
    summary: "Discussion around source feature schema evolution.",
    url: "https://news.ycombinator.com/item?id=123",
    publishedAt: "2026-05-05T08:00:00.000Z",
    collectedAt: "2026-05-05T08:10:00.000Z",
    timestampOrigin: "source",
    tags: ["schema", "hn"],
    sourceFeatures: {
      points: 100,
    },
    fingerprint: "sha256:123",
    evidenceRefs: [],
    legacyRefs: {
      itemId: "11111111-1111-5111-8111-111111111111",
      itemSourceId: null,
    },
    rawMeta: {},
  };

  assert.equal(isUnifiedContentRecord(invalidRecord), false);
});
