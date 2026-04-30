import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "@devtrend/api";
import { buildQuestionPressurePipeline } from "@devtrend/domain";
import { normalizedDemoItems, sourceCommands } from "@devtrend/sources";
import type { ReadServices } from "../../../apps/api/src/services/types.js";

const sourceStatus = {
  stackoverflow: {
    status: "healthy" as const,
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
    lastErrorAt: null,
    lastErrorText: null,
    fallbackUsed: false,
    lastLatencyMs: 100,
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
    status: "degraded" as const,
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
    lastErrorAt: "2026-04-29T00:10:00.000Z",
    lastErrorText: "timeout",
    fallbackUsed: true,
    lastLatencyMs: 5000,
  },
  ossinsight: {
    status: "healthy" as const,
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
    lastErrorAt: null,
    lastErrorText: null,
    fallbackUsed: false,
    lastLatencyMs: 130,
  },
};

const pipeline = buildQuestionPressurePipeline(
  normalizedDemoItems(sourceCommands),
  sourceStatus,
);

const services: ReadServices = {
  checkHealth: async () => true,
  checkReadiness: async () => true,
  getSourceStatus: async () => sourceStatus,
  getFeed: async () => pipeline.feed,
  getQuestionPressure: async () => pipeline.signals,
  getQuestionCluster: async (clusterId) =>
    pipeline.signals.find((signal) => signal.clusterId === clusterId) ?? null,
  getQuestionEvidence: async (clusterId) =>
    pipeline.evidenceByClusterId[clusterId] ?? [],
};

test("GET /healthz works", async () => {
  const app = await buildApp({
    registerDataPlugins: false,
    services,
    config: {
      PORT: 3000,
      HOST: "0.0.0.0",
      LOG_LEVEL: "error",
      DATABASE_URL: "postgres://example",
      REDIS_URL: "redis://example",
      OPENCLI_BIN: "opencli",
      OPENCLI_TIMEOUT_MS: 1000,
      CACHE_TTL_MINUTES: 15,
      QUEUE_PREFIX: "devtrend",
      SOURCE_POLL_SO_CRON: "*/20 * * * *",
      SOURCE_POLL_HN_CRON: "*/20 * * * *",
      SOURCE_POLL_DEVTO_CRON: "*/30 * * * *",
      SOURCE_POLL_OSSINSIGHT_CRON: "*/30 * * * *",
      TOPIC_SEED_REFRESH_CRON: "0 * * * *",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/healthz",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
  await app.close();
});

test("GET /signals/question-pressure returns metadata and signals", async () => {
  const app = await buildApp({
    registerDataPlugins: false,
    services,
    config: {
      PORT: 3000,
      HOST: "0.0.0.0",
      LOG_LEVEL: "error",
      DATABASE_URL: "postgres://example",
      REDIS_URL: "redis://example",
      OPENCLI_BIN: "opencli",
      OPENCLI_TIMEOUT_MS: 1000,
      CACHE_TTL_MINUTES: 15,
      QUEUE_PREFIX: "devtrend",
      SOURCE_POLL_SO_CRON: "*/20 * * * *",
      SOURCE_POLL_HN_CRON: "*/20 * * * *",
      SOURCE_POLL_DEVTO_CRON: "*/30 * * * *",
      SOURCE_POLL_OSSINSIGHT_CRON: "*/30 * * * *",
      TOPIC_SEED_REFRESH_CRON: "0 * * * *",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/signals/question-pressure?topic=mcp",
  });

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().data));
  assert.ok(response.json().meta.generatedAt);
  assert.ok(response.json().meta.sourceStatus.stackoverflow);
  assert.equal(response.json().meta.fallbackUsed, true);
  assert.equal(
    response.json().meta.sourceStatus.devto.lastErrorText,
    "timeout",
  );
  await app.close();
});

test("GET /question-clusters/:id/evidence returns evidence rows", async () => {
  const firstSignal = pipeline.signals[0];
  const app = await buildApp({
    registerDataPlugins: false,
    services,
    config: {
      PORT: 3000,
      HOST: "0.0.0.0",
      LOG_LEVEL: "error",
      DATABASE_URL: "postgres://example",
      REDIS_URL: "redis://example",
      OPENCLI_BIN: "opencli",
      OPENCLI_TIMEOUT_MS: 1000,
      CACHE_TTL_MINUTES: 15,
      QUEUE_PREFIX: "devtrend",
      SOURCE_POLL_SO_CRON: "*/20 * * * *",
      SOURCE_POLL_HN_CRON: "*/20 * * * *",
      SOURCE_POLL_DEVTO_CRON: "*/30 * * * *",
      SOURCE_POLL_OSSINSIGHT_CRON: "*/30 * * * *",
      TOPIC_SEED_REFRESH_CRON: "0 * * * *",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: `/question-clusters/${firstSignal.clusterId}/evidence`,
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.json().data.length > 0);
  assert.ok(response.json().data[0].collectedAt);
  assert.equal(
    typeof response.json().data[0].sourceRunId !== "undefined",
    true,
  );
  await app.close();
});
