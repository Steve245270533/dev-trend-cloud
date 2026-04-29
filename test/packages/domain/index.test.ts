import assert from "node:assert/strict";
import test from "node:test";
import { buildQuestionPressurePipeline } from "../../../packages/domain/src/index.js";
import { sourceCommands } from "../../../packages/sources/src/command-registry.js";
import { normalizedDemoItems } from "../../../packages/sources/src/index.js";

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

  const secondPipeline = buildQuestionPressurePipeline(
    normalizedDemoItems(sourceCommands),
    sourceStatus,
  );

  assert.deepEqual(
    pipeline.signals.map((signal) => signal.clusterId).sort(),
    secondPipeline.signals.map((signal) => signal.clusterId).sort(),
  );
});
