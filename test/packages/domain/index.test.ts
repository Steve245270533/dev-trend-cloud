import assert from "node:assert/strict";
import test from "node:test";
import { buildQuestionPressurePipeline } from "@devtrend/domain";
import { normalizedDemoItems, sourceCommands } from "@devtrend/sources";

const sourceStatus = {
  stackoverflow: {
    status: "healthy" as const,
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
    lastErrorAt: null,
    lastErrorText: null,
    fallbackUsed: false,
    lastLatencyMs: 120,
  },
  hackernews: {
    status: "healthy" as const,
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
    lastErrorAt: null,
    lastErrorText: null,
    fallbackUsed: false,
    lastLatencyMs: 120,
  },
  devto: {
    status: "healthy" as const,
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
    lastErrorAt: null,
    lastErrorText: null,
    fallbackUsed: false,
    lastLatencyMs: 120,
  },
  ossinsight: {
    status: "healthy" as const,
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
    lastErrorAt: null,
    lastErrorText: null,
    fallbackUsed: false,
    lastLatencyMs: 120,
  },
};

test("question pressure pipeline returns feed, signals, and evidence", () => {
  const pipeline = buildQuestionPressurePipeline(
    normalizedDemoItems(sourceCommands),
    sourceStatus,
  );

  assert.ok(pipeline.feed.length > 0);
  assert.ok(pipeline.signals.length > 0);
  assert.ok(Object.keys(pipeline.evidenceByClusterId).length > 0);
  assert.ok(
    pipeline.signals.some((signal) =>
      signal.affectedTopics.some(
        (topic) => topic === "mcp" || topic === "vector-databases",
      ),
    ),
  );
  assert.equal(
    pipeline.feed.some(
      (item) =>
        item.title ===
          "Why does vector similarity search return unstable results in pgvector?" &&
        item.topics.some((topic) => topic.slug === "typescript"),
    ),
    false,
  );
  assert.equal(
    pipeline.signals.some((signal) => signal.evidenceCount >= 3),
    true,
  );
  assert.equal(
    pipeline.signals.some(
      (signal) => Object.keys(signal.sourceDistribution).length >= 2,
    ),
    true,
  );
  assert.equal(
    pipeline.signals
      .filter((signal) => signal.evidenceCount < 3)
      .every((signal) => signal.confidenceScore <= 0.45),
    true,
  );

  const secondPipeline = buildQuestionPressurePipeline(
    normalizedDemoItems(sourceCommands),
    sourceStatus,
  );

  assert.deepEqual(
    pipeline.signals.map((signal) => signal.clusterId).sort(),
    secondPipeline.signals.map((signal) => signal.clusterId).sort(),
  );
});

test("question pressure regression keeps demo signal baselines stable", () => {
  const pipeline = buildQuestionPressurePipeline(
    normalizedDemoItems(sourceCommands),
    sourceStatus,
  );

  assert.equal(pipeline.signals.length, 8);

  const mcpSignal = pipeline.signals.find(
    (signal) =>
      signal.canonicalQuestion ===
      "Ask HN: How are you debugging MCP tool calling failures?",
  );
  assert.ok(mcpSignal);
  assert.equal(mcpSignal.evidenceCount, 4);
  assert.equal(mcpSignal.pressureScore, 31);
  assert.deepEqual(mcpSignal.sourceDistribution, {
    devto: 1,
    hackernews: 2,
    stackoverflow: 1,
  });

  const pgvectorSignal = pipeline.signals.find(
    (signal) =>
      signal.canonicalQuestion ===
      "Why pgvector is becoming the default RAG storage layer",
  );
  assert.ok(pgvectorSignal);
  assert.equal(pgvectorSignal.evidenceCount, 4);
  assert.equal(pgvectorSignal.pressureScore, 36);
  assert.deepEqual(pgvectorSignal.sourceDistribution, {
    devto: 2,
    hackernews: 1,
    stackoverflow: 1,
  });
});
