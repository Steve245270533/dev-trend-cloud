import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmbeddingInput,
  buildEmbeddingInputFromUnifiedContent,
  isEmbeddingInputRecord,
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

test("embedding input guard accepts required whitelist fields", () => {
  const payload = {
    canonicalId: "devto:123",
    source: "devto",
    title: "  Stable   Embedding Input  ",
    summary: "Keep deterministic guardrails in the pipeline.",
    bodyExcerpt: "Only selected fields should be embedded.",
    tags: ["MCP", "contracts", "mcp"],
  };

  assert.equal(isEmbeddingInputRecord(payload), true);
});

test("embedding input builder keeps deterministic order and stable fingerprint", () => {
  const first = buildEmbeddingInput({
    canonicalId: "devto:123",
    source: "devto",
    title: "  Stable   Embedding Input  ",
    summary: "Keep deterministic guardrails in the pipeline.",
    bodyExcerpt: "Only selected fields should be embedded.",
    tags: ["MCP", "contracts", "mcp"],
  });
  const second = buildEmbeddingInput({
    canonicalId: "devto:123",
    source: "devto",
    title: "Stable Embedding Input",
    summary: "Keep deterministic guardrails in the pipeline.",
    bodyExcerpt: "Only selected fields should be embedded.",
    tags: ["contracts", "mcp"],
  });

  assert.equal(
    first.input,
    [
      "source:devto",
      "title:Stable Embedding Input",
      "summary:Keep deterministic guardrails in the pipeline.",
      "bodyExcerpt:Only selected fields should be embedded.",
      "tags:contracts,mcp",
    ].join("\n"),
  );
  assert.equal(first.inputFingerprint, second.inputFingerprint);
  assert.equal(first.inputFingerprint.startsWith("sha256:"), true);
});

test("embedding input builder excludes rawMeta and legacyRefs fields", () => {
  const payload = buildEmbeddingInputFromUnifiedContent({
    canonicalId: "hackernews:456",
    source: "hackernews",
    sourceItemId: "456",
    title: "Ask HN: guardrails for embedding payload?",
    summary: "Should include source/title/summary/body/tags only.",
    bodyExcerpt: "Exclude legacy references and raw metadata.",
    url: "https://news.ycombinator.com/item?id=456",
    publishedAt: "2026-05-05T08:00:00.000Z",
    collectedAt: "2026-05-05T08:10:00.000Z",
    timestampOrigin: "source",
    tags: ["guardrails", "embedding"],
    sourceFeatures: validSourceFeatures,
    fingerprint: "sha256:origin-fingerprint",
    evidenceRefs: ["https://news.ycombinator.com/item?id=456"],
    legacyRefs: {
      itemId: "11111111-1111-5111-8111-111111111111",
      itemSourceId: null,
    },
    rawMeta: {
      secretToken: "do-not-leak",
      internalDebugOnly: true,
    },
  });

  assert.notEqual(payload, null);
  assert.equal(payload?.input.includes("legacyRefs"), false);
  assert.equal(payload?.input.includes("rawMeta"), false);
  assert.equal(payload?.input.includes("secretToken"), false);
  assert.equal(payload?.input.includes("source:hackernews"), true);
});

test("embedding input guard rejects invalid source and empty summary", () => {
  assert.equal(
    isEmbeddingInputRecord({
      canonicalId: "invalid:1",
      source: "invalid-source",
      title: "x",
      summary: "y",
      tags: [],
    }),
    false,
  );

  assert.equal(
    isEmbeddingInputRecord({
      canonicalId: "devto:123",
      source: "devto",
      title: "x",
      summary: "   ",
      tags: [],
    }),
    false,
  );
});
