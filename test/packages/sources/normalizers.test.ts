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
});
