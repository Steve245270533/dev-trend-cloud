import { randomUUID } from "node:crypto";
import type {
  NormalizedItem,
  RuntimeTopicSeed,
  RuntimeTopicSeedRun,
  SourceKey,
  SourceStatus,
} from "@devtrend/contracts";
import {
  getLatestRuntimeTopicSeedSnapshot,
  getLatestSuccessfulSnapshot,
  getSourceStatusMap,
  insertRuntimeTopicSeedRun,
  insertSourceStatus,
  listActiveRuntimeTopicSeeds,
  listAllNormalizedItems,
  listCatalogTopics,
  recordCollectionArtifacts,
  replaceDerivedPipelineOutput,
  replaceRuntimeTopicSeeds,
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
import {
  type CircuitBreakerStore,
  discoverRuntimeTopicCandidates,
  mergeRuntimeTopicCandidates,
  normalizeCollectedPayloads,
} from "@devtrend/sources";
import type { Pool } from "pg";
import { noopWorkerLogger, type WorkerLogger } from "./logger.js";

export interface WorkerBootstrapState {
  hasActiveRuntimeTopicSnapshot: boolean;
  hasPersistedItems: boolean;
}

export interface WorkerBootstrapPlan {
  refreshRuntimeTopics: boolean;
  collectSources: SourceKey[];
}

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
              capability: payload.capability,
              status: payload.status,
              executionDecision: payload.executionDecision,
              breakerKey: payload.breakerKey,
              adapterKey: payload.adapterKey,
              routeRole: payload.routeRole,
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
        executionDecision: "fallback-snapshot",
        payload: snapshot.payload,
        fallbackSourceRunId: snapshot.sourceRunId,
        fallbackSnapshotId: snapshot.snapshotId,
        fallbackCollectedAt: snapshot.collectedAt,
      });
    }

    return resolved;
  });
}

function summarizePayloadStatuses(
  payloads: CollectedSourcePayload[],
): Record<CollectedSourcePayload["status"], number> {
  const summary: Record<CollectedSourcePayload["status"], number> = {
    success: 0,
    failed: 0,
    fallback: 0,
  };

  for (const payload of payloads) {
    summary[payload.status] += 1;
  }

  return summary;
}

export async function persistCollectedPayloads(
  pool: Pool,
  payloads: CollectedSourcePayload[],
  logger: WorkerLogger = noopWorkerLogger(),
) {
  const startedAt = Date.now();
  await logger.info("pipeline.persist.start", {
    payloadCount: payloads.length,
    payloadStatusSummary: summarizePayloadStatuses(payloads),
  });
  const resolvedPayloads = await resolveCollectedPayloads(payloads, pool);
  await logger.info("pipeline.persist.payloads.resolved", {
    payloadCount: resolvedPayloads.length,
    payloadStatusSummary: summarizePayloadStatuses(resolvedPayloads),
  });
  const sourceStatus = buildSourceStatus(resolvedPayloads);
  const replaceableSources = [
    ...new Set(
      resolvedPayloads
        .filter(
          (payload) =>
            payload.status === "success" || payload.status === "fallback",
        )
        .map((payload) => payload.source),
    ),
  ];
  let persistedItems = 0;
  let persistedSignals = 0;

  await withTransaction(pool, async (client) => {
    const artifacts = await recordCollectionArtifacts(client, resolvedPayloads);
    await logger.info("pipeline.persist.pg.recordCollectionArtifacts", {
      artifactsCount: Object.keys(artifacts).length,
    });
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
      replaceableSources,
      artifacts,
    );
    await logger.info("pipeline.persist.pg.replaceSourceItems", {
      sourceCount: replaceableSources.length,
      feedItems: sourcePipeline.feed.length,
      signals: sourcePipeline.signals.length,
    });

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
    await logger.info("pipeline.persist.pg.replaceDerivedPipelineOutput", {
      totalItems: fullItems.length,
      sourceCount: Object.keys(fullSourceStatus).length,
      signals: globalPipeline.signals.length,
    });
  });

  await logger.info("pipeline.persist.done", {
    durationMs: Date.now() - startedAt,
    items: persistedItems,
    signals: persistedSignals,
  });

  return {
    items: persistedItems,
    signals: persistedSignals,
  };
}

function runtimeTopicRunStatus(
  remoteTopics: RuntimeTopicSeed[],
  sourceStatuses: {
    source: "ossinsight" | "devto";
    status: "success" | "failed";
  }[],
): RuntimeTopicSeedRun["status"] {
  const ossInsightHealthy = sourceStatuses.some(
    (status) => status.source === "ossinsight" && status.status === "success",
  );
  const devtoHealthy = sourceStatuses.some(
    (status) => status.source === "devto" && status.status === "success",
  );

  if (ossInsightHealthy && devtoHealthy && remoteTopics.length > 0) {
    return "success";
  }

  if ((ossInsightHealthy || devtoHealthy) && remoteTopics.length > 0) {
    return "degraded";
  }

  return "fallback";
}

export function planWorkerBootstrap(
  state: WorkerBootstrapState,
  sources: SourceKey[],
): WorkerBootstrapPlan {
  return {
    refreshRuntimeTopics: !state.hasActiveRuntimeTopicSnapshot,
    collectSources: state.hasPersistedItems ? [] : [...sources],
  };
}

export async function loadRuntimeTopics(
  pool: Pool,
): Promise<RuntimeTopicSeed[]> {
  return withTransaction(pool, async (client) =>
    listActiveRuntimeTopicSeeds(client),
  );
}

export async function refreshRuntimeTopicSeeds(
  pool: Pool,
  openCliBin: string,
  timeoutMs: number,
  discoverTopics: typeof discoverRuntimeTopicCandidates = discoverRuntimeTopicCandidates,
  logger: WorkerLogger = noopWorkerLogger(),
  breakerStore?: CircuitBreakerStore,
) {
  const startedAtMs = Date.now();
  const startedAt = new Date().toISOString();
  await logger.info("pipeline.runtime-topics.refresh.start", {
    openCliBin,
    timeoutMs,
    startedAt,
  });
  const seedContext = await withTransaction(pool, async (client) => ({
    fallbackTopics: await listCatalogTopics(client),
    latestSnapshot: await getLatestRuntimeTopicSeedSnapshot(client),
  }));

  let discoveredCandidates: RuntimeTopicSeed[] = [];
  let sourceStatuses: {
    source: "ossinsight" | "devto";
    status: "success" | "failed";
    errorText: string | null;
    candidateCount: number;
  }[] = [];
  let finalTopics: RuntimeTopicSeed[] = [];
  let fallbackUsed = false;
  let errorText: string | null = null;

  try {
    await logger.info("pipeline.runtime-topics.discovery.start", {
      fallbackTopicCount: seedContext.fallbackTopics.length,
      latestSnapshotCount: seedContext.latestSnapshot.length,
    });
    const discovery = await discoverTopics(
      openCliBin,
      timeoutMs,
      undefined,
      undefined,
      breakerStore,
    );
    sourceStatuses = discovery.sourceStatuses;
    discoveredCandidates = mergeRuntimeTopicCandidates(
      discovery.candidates,
      [],
      new Date(startedAt),
    );
    finalTopics = mergeRuntimeTopicCandidates(
      discovery.candidates,
      seedContext.fallbackTopics,
    );

    const hasRemoteFailure = sourceStatuses.some(
      (status) => status.status === "failed",
    );
    fallbackUsed = hasRemoteFailure || discovery.candidates.length === 0;
    await logger.info("pipeline.runtime-topics.discovery.done", {
      discoveredCandidates: discovery.candidates.length,
      mergedCandidates: finalTopics.length,
      fallbackUsed,
      sourceStatuses,
    });
  } catch (error) {
    errorText = error instanceof Error ? error.message : String(error);
    sourceStatuses = [
      {
        source: "ossinsight",
        status: "failed",
        errorText,
        candidateCount: 0,
      },
      {
        source: "devto",
        status: "failed",
        errorText,
        candidateCount: 0,
      },
    ];
    fallbackUsed = true;
    await logger.error("pipeline.runtime-topics.discovery.failed", {
      error: errorText,
    });
  }

  const finishedAt = new Date().toISOString();
  const runId = randomUUID();
  const status = runtimeTopicRunStatus(discoveredCandidates, sourceStatuses);
  const hasRemoteSuccess = sourceStatuses.some(
    (sourceStatus) => sourceStatus.status === "success",
  );

  await withTransaction(pool, async (client) => {
    await insertRuntimeTopicSeedRun(client, {
      id: runId,
      status,
      startedAt,
      finishedAt,
      fallbackUsed,
      errorText,
      metadata: {
        sourceStatuses,
        discoveredTopics: discoveredCandidates.length,
        mergedTopics: finalTopics.length,
      },
    });
    await logger.info("pipeline.runtime-topics.pg.insertRun", {
      runId,
      status,
      fallbackUsed,
      discoveredTopics: discoveredCandidates.length,
      mergedTopics: finalTopics.length,
    });

    if (hasRemoteSuccess && finalTopics.length > 0) {
      await replaceRuntimeTopicSeeds(
        client,
        runId,
        finalTopics.map((topic) => ({
          ...topic,
          runId,
          refreshedAt: finishedAt,
          expiresAt: new Date(
            new Date(finishedAt).getTime() + 2 * 60 * 60 * 1000,
          ).toISOString(),
        })),
      );
      await logger.info("pipeline.runtime-topics.pg.replaceSeeds", {
        runId,
        topics: finalTopics.length,
        strategy: "remote-or-merged",
      });
      return;
    }

    if (seedContext.latestSnapshot.length === 0) {
      const fallbackTopics = seedContext.fallbackTopics.map((topic) => ({
        ...topic,
        runId,
        refreshedAt: finishedAt,
        expiresAt: new Date(
          new Date(finishedAt).getTime() + 2 * 60 * 60 * 1000,
        ).toISOString(),
      }));
      await replaceRuntimeTopicSeeds(client, runId, fallbackTopics);
      await logger.warn("pipeline.runtime-topics.pg.replaceSeeds", {
        runId,
        topics: fallbackTopics.length,
        strategy: "fallback-catalog",
      });
    }
  });

  const finalTopicCount =
    hasRemoteSuccess && finalTopics.length > 0
      ? finalTopics.length
      : seedContext.latestSnapshot.length > 0
        ? seedContext.latestSnapshot.length
        : seedContext.fallbackTopics.length;
  await logger.info("pipeline.runtime-topics.refresh.done", {
    durationMs: Date.now() - startedAtMs,
    topics: finalTopicCount,
    status,
    fallbackUsed,
  });

  return {
    topics: finalTopicCount,
    status,
    fallbackUsed,
  };
}
