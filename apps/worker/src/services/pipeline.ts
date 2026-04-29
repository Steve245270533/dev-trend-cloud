import type { NormalizedItem, SourceStatus } from "@devtrend/contracts";
import {
  getLatestSuccessfulSnapshot,
  getSourceStatusMap,
  insertSourceStatus,
  listAllNormalizedItems,
  recordCollectionArtifacts,
  replaceDerivedPipelineOutput,
  replaceSourceItems,
  upsertCatalog,
  withTransaction,
} from "@devtrend/db";
import {
  buildQuestionPressurePipeline,
  entitySeeds,
  topicSeeds,
} from "@devtrend/domain";
import type { CollectedSourcePayload } from "@devtrend/sources";
import { normalizeCollectedPayloads } from "@devtrend/sources";
import type { Pool } from "pg";

function buildPayloadKey(source: string, commandName: string): string {
  return `${source}:${commandName}`;
}

function successTimestamp(payload: CollectedSourcePayload): string | null {
  if (payload.status === "success") {
    return payload.finishedAt;
  }

  if (payload.status === "fallback") {
    return payload.fallbackCollectedAt ?? payload.finishedAt;
  }

  return null;
}

function buildSourceStatus(
  payloads: CollectedSourcePayload[],
): Record<string, SourceStatus> {
  const grouped = payloads.reduce<Record<string, CollectedSourcePayload[]>>(
    (accumulator, payload) => {
      accumulator[payload.source] = [
        ...(accumulator[payload.source] ?? []),
        payload,
      ];
      return accumulator;
    },
    {},
  );

  return Object.fromEntries(
    Object.entries(grouped).map(([source, sourcePayloads]) => {
      const hasLiveSuccess = sourcePayloads.some(
        (payload) => payload.status === "success",
      );
      const hasFallback = sourcePayloads.some(
        (payload) => payload.status === "fallback",
      );
      const hasUsablePayload = sourcePayloads.some(
        (payload) =>
          payload.status === "success" || payload.status === "fallback",
      );
      const hasFailedAttempt = sourcePayloads.some(
        (payload) => payload.status === "failed",
      );
      const latestSuccessAt =
        sourcePayloads
          .map(successTimestamp)
          .filter((value): value is string => value !== null)
          .sort()
          .at(-1) ?? null;
      const latestErrorPayload = [...sourcePayloads]
        .filter((payload) => payload.errorText !== null)
        .sort((left, right) => left.finishedAt.localeCompare(right.finishedAt))
        .at(-1);

      const status: SourceStatus["status"] = !hasUsablePayload
        ? "failed"
        : hasFallback || hasFailedAttempt || !hasLiveSuccess
          ? "degraded"
          : "healthy";

      return [
        source,
        {
          status,
          lastSuccessAt: latestSuccessAt,
          lastErrorAt: latestErrorPayload?.finishedAt ?? null,
          lastErrorText: latestErrorPayload?.errorText ?? null,
          fallbackUsed: hasFallback,
          lastLatencyMs: Math.max(
            0,
            ...sourcePayloads.map((payload) => payload.latencyMs),
          ),
          metadata: {
            commands: sourcePayloads.map((payload) => ({
              commandName: payload.commandName,
              status: payload.status,
              fallbackSnapshotId: payload.fallbackSnapshotId ?? null,
            })),
          },
        },
      ] satisfies [
        string,
        SourceStatus & { metadata: Record<string, unknown> },
      ];
    }),
  );
}

function enrichNormalizedItems(
  items: NormalizedItem[],
  artifacts: Record<
    string,
    {
      sourceRunId: string;
      snapshotId: string | null;
      collectedAt: string;
      fallbackUsed: boolean;
    }
  >,
): NormalizedItem[] {
  return items.map((item) => {
    const commandName =
      typeof item.rawMeta.commandName === "string"
        ? item.rawMeta.commandName
        : item.contentType;
    const artifact = artifacts[buildPayloadKey(item.source, commandName)];
    const collectedAt = artifact?.collectedAt ?? item.collectedAt;

    return {
      ...item,
      collectedAt,
      rawMeta: {
        ...item.rawMeta,
        collectedAt,
        timestampOrigin: item.timestampOrigin,
        sourceRunId: artifact?.sourceRunId ?? null,
        snapshotId: artifact?.snapshotId ?? null,
        fallbackUsed: artifact?.fallbackUsed ?? false,
      },
    };
  });
}

async function resolveCollectedPayloads(
  payloads: CollectedSourcePayload[],
  pool: Pool,
): Promise<CollectedSourcePayload[]> {
  return withTransaction(pool, async (client) => {
    const resolved: CollectedSourcePayload[] = [];

    for (const payload of payloads) {
      if (payload.status === "success") {
        resolved.push(payload);
        continue;
      }

      const snapshot = await getLatestSuccessfulSnapshot(
        client,
        payload.source,
        payload.commandName,
      );

      if (!snapshot) {
        resolved.push(payload);
        continue;
      }

      resolved.push({
        ...payload,
        status: "fallback",
        payload: snapshot.payload,
        fallbackSourceRunId: snapshot.sourceRunId,
        fallbackSnapshotId: snapshot.snapshotId,
        fallbackCollectedAt: snapshot.collectedAt,
      });
    }

    return resolved;
  });
}

export async function persistCollectedPayloads(
  pool: Pool,
  payloads: CollectedSourcePayload[],
) {
  const resolvedPayloads = await resolveCollectedPayloads(payloads, pool);
  const sourceStatus = buildSourceStatus(resolvedPayloads);
  let persistedItems = 0;
  let persistedSignals = 0;

  await withTransaction(pool, async (client) => {
    const artifacts = await recordCollectionArtifacts(client, resolvedPayloads);
    const items = enrichNormalizedItems(
      normalizeCollectedPayloads(resolvedPayloads),
      artifacts,
    );
    const sourcePipeline = buildQuestionPressurePipeline(items, sourceStatus);
    persistedItems = sourcePipeline.feed.length;
    persistedSignals = sourcePipeline.signals.length;

    await upsertCatalog(client, topicSeeds, entitySeeds);
    await insertSourceStatus(client, sourceStatus);
    await replaceSourceItems(
      client,
      sourcePipeline,
      Object.keys(sourceStatus),
      artifacts,
    );

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
    items: persistedItems,
    signals: persistedSignals,
  };
}
