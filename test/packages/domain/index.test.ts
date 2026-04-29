import assert from "node:assert/strict";
import test from "node:test";
import { buildQuestionPressurePipeline } from "@devtrend/domain";
import { normalizedDemoItems, sourceCommands } from "@devtrend/sources";

test("question pressure pipeline returns feed, signals, and evidence", () => {
  const sourceStatus = {
    stackoverflow: {
      status: "healthy" as const,
      lastSuccessAt: "2026-04-29T00:00:00.000Z",
    },
    hackernews: {
      status: "healthy" as const,
      lastSuccessAt: "2026-04-29T00:00:00.000Z",
    },
    devto: {
      status: "healthy" as const,
      lastSuccessAt: "2026-04-29T00:00:00.000Z",
    },
    ossinsight: {
      status: "healthy" as const,
      lastSuccessAt: "2026-04-29T00:00:00.000Z",
    },
  };

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
