import type { Pool } from "pg";
import {
  getSourceStatusMap,
  insertSourceStatus,
  listAllNormalizedItems,
  recordCollectionArtifacts,
  replaceDerivedPipelineOutput,
  replaceSourceItems,
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
  const sourcePipeline = buildQuestionPressurePipeline(items, sourceStatus);

  await withTransaction(pool, async (client) => {
    await recordCollectionArtifacts(client, payloads);
    await insertSourceStatus(client, sourceStatus);
    await replaceSourceItems(client, sourcePipeline, Object.keys(sourceStatus));

    const fullItems = await listAllNormalizedItems(client);
    const fullSourceStatus = await getSourceStatusMap(client);
    const globalPipeline = buildQuestionPressurePipeline(
      fullItems,
      fullSourceStatus,
    );
    await replaceDerivedPipelineOutput(
      client,
      globalPipeline,
      fullSourceStatus,
    );
  });

  return {
    items: sourcePipeline.feed.length,
    signals: sourcePipeline.signals.length,
  };
}
