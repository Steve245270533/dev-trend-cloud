import assert from "node:assert/strict";
import test from "node:test";
import { demoCommandPayloads, normalizeSourcePayload } from "@devtrend/sources";

test("normalize source payload creates normalized items for Stack Overflow", () => {
  const items = normalizeSourcePayload(
    "stackoverflow",
    "hot",
    demoCommandPayloads["stackoverflow:hot"],
  );

  assert.equal(items[0].source, "stackoverflow");
  assert.equal(items[0].isQuestion, true);
  assert.ok(items[0].collectedAt);
  assert.equal(items[0].timestampOrigin, "collected");
  assert.ok(items[0].title.includes("Model Context Protocol"));
});

test("normalize source payload creates normalized items for OSSInsight", () => {
  const items = normalizeSourcePayload(
    "ossinsight",
    "trending",
    demoCommandPayloads["ossinsight:trending"],
  );

  assert.equal(items[0].source, "ossinsight");
  assert.equal(items[0].isQuestion, false);
  assert.ok(items[0].url.includes("github.com"));
  assert.equal(items[0].timestampOrigin, "collected");
});

test("normalize source payload handles DEV tag strings and source timestamps", () => {
  const items = normalizeSourcePayload("devto", "tag", [
    {
      title: "How do teams validate MCP tool calling schemas?",
      author: "ivy",
      reactions: 35,
      comments: 8,
      tags: "mcp, tool-calling, typescript",
      url: "https://dev.to/example/mcp-schema-validation",
      published_at: "2026-04-28T09:30:00.000Z",
    },
  ]);

  assert.deepEqual(items[0]?.tags, ["mcp", "tool-calling", "typescript"]);
  assert.equal(items[0]?.timestampOrigin, "source");
  assert.equal(items[0]?.publishedAt, "2026-04-28T09:30:00.000Z");
});

test("normalize source payload only emits URLs derived from real source fields", () => {
  const stackOverflowItems = normalizeSourcePayload("stackoverflow", "search", [
    {
      title: "How do I validate MCP tools in Stack Overflow style payloads?",
      question_id: 12345678,
    },
    {
      title: "Question without source URL or id",
    },
  ]);
  const hackerNewsItems = normalizeSourcePayload("hackernews", "search", [
    {
      title: "Ask HN: Why MCP instead of just HTTP?",
      score: 3,
      author: "bschmidt44",
      comments: 2,
    },
    {
      id: 47946850,
      title: "Ask HN item with real id",
    },
  ]);
  const devToItems = normalizeSourcePayload("devto", "tag", [
    {
      title: "DEV item without source URL",
      author: "ivy",
    },
  ]);
  const ossInsightItems = normalizeSourcePayload("ossinsight", "collections", [
    {
      collection_name: "Web Framework",
      value: 12,
    },
    {
      repo_name: "fastify/fastify",
      stars: 10,
    },
  ]);

  assert.equal(
    stackOverflowItems[0]?.url,
    "https://stackoverflow.com/questions/12345678",
  );
  assert.equal(stackOverflowItems[1]?.url, "");
  assert.equal(hackerNewsItems[0]?.url, "");
  assert.equal(
    hackerNewsItems[1]?.url,
    "https://news.ycombinator.com/item?id=47946850",
  );
  assert.equal(
    hackerNewsItems[0]?.sourceItemId,
    "search:Ask HN: Why MCP instead of just HTTP?",
  );
  assert.equal(devToItems[0]?.url, "");
  assert.equal(ossInsightItems[0]?.url, "");
  assert.equal(ossInsightItems[1]?.url, "https://github.com/fastify/fastify");
});

test("normalize source payload does not treat Tell HN titles as questions", () => {
  const items = normalizeSourcePayload("hackernews", "ask", [
    {
      title: "Tell HN: One Medical Is a Nightmare",
      score: 10,
      author: "alice",
      comments: 4,
    },
    {
      title: "Ask HN: Why is MCP tool calling so brittle in production?",
      score: 22,
      author: "bob",
      comments: 11,
    },
  ]);

  assert.equal(items[0]?.isQuestion, false);
  assert.equal(items[1]?.isQuestion, true);
});
