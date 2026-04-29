import type { Pool } from "pg";
import {
  insertPipelineOutput,
  insertSourceStatus,
  recordCollectionArtifacts,
  resetRuntimeTables,
  withTransaction,
} from "../../../../packages/db/src/index.js";
import { buildQuestionPressurePipeline } from "../../../../packages/domain/src/index.js";
import type { CollectedSourcePayload } from "../../../../packages/sources/src/collectors/index.js";
import { normalizeCollectedPayloads } from "../../../../packages/sources/src/index.js";

export async function persistCollectedPayloads(
  pool: Pool,
  payloads: CollectedSourcePayload[],
) {
  const sourceStatus = payloads.reduce<
    Record<string, { status: "healthy"; lastSuccessAt: string }>
  >((accumulator, payload) => {
    accumulator[payload.source] = {
      status: "healthy",
      lastSuccessAt: new Date().toISOString(),
    };
    return accumulator;
  }, {});

  const items = normalizeCollectedPayloads(payloads);
  const pipeline = buildQuestionPressurePipeline(items, sourceStatus);

  await withTransaction(pool, async (client) => {
    await recordCollectionArtifacts(client, payloads);
    await resetRuntimeTables(client);
    await insertSourceStatus(client, sourceStatus);
    await insertPipelineOutput(client, pipeline, sourceStatus);
  });

  return {
    items: pipeline.feed.length,
    signals: pipeline.signals.length,
  };
}
