import { createHash, randomUUID } from "node:crypto";
import type {
  NormalizedItem,
  RuntimeTopicSeed,
  RuntimeTopicSeedRun,
  SourceFeatures,
  SourceKey,
  SourceStatus,
  UnifiedContentRecord,
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
  upsertUnifiedContentRecords,
  withTransaction,
} from "@devtrend/db";
import {
  buildQuestionPressurePipeline,
  entitySeeds,
  isValidSourceFeatures,
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

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveSourceSpecificFeatures(item: NormalizedItem): SourceFeatures {
  const rawMeta = isObjectLike(item.rawMeta) ? item.rawMeta : {};

  if (item.source === "stackoverflow") {
    return {
      shared: {
        score: item.score,
        answerCount: item.answerCount,
        commentCount: item.commentCount,
        viewCount:
          toNonNegativeInteger(rawMeta.view_count) ??
          toNonNegativeInteger(rawMeta.viewCount) ??
          toNonNegativeInteger(rawMeta.views),
      },
      stackoverflow: {
        answerCount: item.answerCount,
        commentCount: item.commentCount,
        viewCount:
          toNonNegativeInteger(rawMeta.view_count) ??
          toNonNegativeInteger(rawMeta.viewCount) ??
          toNonNegativeInteger(rawMeta.views),
        hasAcceptedAnswer:
          typeof rawMeta.is_answered === "boolean"
            ? rawMeta.is_answered
            : rawMeta.accepted_answer_id !== undefined
              ? true
              : undefined,
      },
    };
  }

  if (item.source === "hackernews") {
    const postKind =
      typeof rawMeta.postKind === "string"
        ? rawMeta.postKind
        : /^ask hn:/i.test(item.title)
          ? "ask"
          : /^show hn:/i.test(item.title)
            ? "show"
            : /^poll:/i.test(item.title)
              ? "poll"
              : /^job:/i.test(item.title)
                ? "job"
                : "story";
    return {
      shared: {
        score: item.score,
        commentCount: item.commentCount,
      },
      hackernews: {
        points: item.score,
        comments: item.commentCount,
        postKind:
          postKind === "ask" ||
          postKind === "show" ||
          postKind === "story" ||
          postKind === "job" ||
          postKind === "poll"
            ? postKind
            : undefined,
      },
    };
  }

  if (item.source === "devto") {
    return {
      shared: {
        score: item.score,
        reactionCount: item.score,
        commentCount: item.commentCount,
      },
      devto: {
        readingTimeMinutes:
          toNonNegativeInteger(rawMeta.reading_time_minutes) ??
          toNonNegativeInteger(rawMeta.readingTimeMinutes),
        reactionsCount: item.score,
        commentsCount: item.commentCount,
        tagDensity: toNumber(rawMeta.tagDensity),
        tutorialIntent:
          typeof rawMeta.tutorialIntent === "boolean"
            ? rawMeta.tutorialIntent
            : undefined,
      },
    };
  }

  return {
    shared: {
      score: item.score,
      trendScore: item.score,
    },
    ossinsight: {
      starsGrowth:
        toNumber(rawMeta.stars_growth) ?? toNumber(rawMeta.starsGrowth),
      issueCreatorGrowth:
        toNumber(rawMeta.issue_creator_growth) ??
        toNumber(rawMeta.issueCreatorGrowth),
      prCreatorGrowth:
        toNumber(rawMeta.pr_creator_growth) ??
        toNumber(rawMeta.prCreatorGrowth),
      collectionMembership:
        toStringArray(rawMeta.collectionMembership).length > 0
          ? toStringArray(rawMeta.collectionMembership)
          : typeof rawMeta.collection_name === "string"
            ? [rawMeta.collection_name]
            : undefined,
    },
  };
}

function resolveSourceFeatures(item: NormalizedItem): SourceFeatures {
  const rawMeta = isObjectLike(item.rawMeta) ? item.rawMeta : {};
  if (isValidSourceFeatures(rawMeta.sourceFeatures)) {
    return rawMeta.sourceFeatures;
  }

  return resolveSourceSpecificFeatures(item);
}

function resolveBodyExcerpt(item: NormalizedItem): string | undefined {
  const rawMeta = isObjectLike(item.rawMeta) ? item.rawMeta : {};
  if (
    typeof rawMeta.bodyExcerpt === "string" &&
    rawMeta.bodyExcerpt.length > 0
  ) {
    return rawMeta.bodyExcerpt.slice(0, 500);
  }
  if (typeof rawMeta.excerpt === "string" && rawMeta.excerpt.length > 0) {
    return rawMeta.excerpt.slice(0, 500);
  }
  if (typeof rawMeta.body === "string" && rawMeta.body.length > 0) {
    return rawMeta.body.slice(0, 500);
  }
  if (
    typeof rawMeta.description === "string" &&
    rawMeta.description.length > 0
  ) {
    return rawMeta.description.slice(0, 500);
  }
  return undefined;
}

function buildFingerprint(item: NormalizedItem): string {
  const rawMeta = isObjectLike(item.rawMeta) ? item.rawMeta : {};
  if (
    typeof rawMeta.fingerprint === "string" &&
    rawMeta.fingerprint.length > 0
  ) {
    return rawMeta.fingerprint;
  }

  const canonicalText = [
    item.source,
    item.sourceItemId,
    item.title.toLowerCase(),
    item.summary.toLowerCase(),
    item.url.toLowerCase(),
  ].join("|");
  return `sha256:${createHash("sha256").update(canonicalText).digest("hex")}`;
}

function resolveEvidenceRefs(item: NormalizedItem): string[] {
  const rawMeta = isObjectLike(item.rawMeta) ? item.rawMeta : {};
  const rawRefs = toStringArray(rawMeta.evidenceRefs);
  const refs = new Set<string>(rawRefs);
  if (item.url.trim().length > 0) {
    refs.add(item.url.trim());
  }
  return [...refs];
}

function buildUnifiedContentRecords(
  items: NormalizedItem[],
  legacyItemIdBySourceItem: Record<string, string>,
): UnifiedContentRecord[] {
  return items.flatMap((item) => {
    const legacyItemId =
      legacyItemIdBySourceItem[buildPayloadKey(item.source, item.sourceItemId)];
    if (!legacyItemId) {
      return [];
    }

    return [
      {
        canonicalId: `${item.source}:${item.sourceItemId}`,
        source: item.source,
        sourceItemId: item.sourceItemId,
        title: item.title,
        summary: item.summary,
        bodyExcerpt: resolveBodyExcerpt(item),
        url: item.url,
        author: item.author,
        publishedAt: item.publishedAt,
        collectedAt: item.collectedAt,
        timestampOrigin: item.timestampOrigin,
        tags: item.tags,
        sourceFeatures: resolveSourceFeatures(item),
        fingerprint: buildFingerprint(item),
        evidenceRefs: resolveEvidenceRefs(item),
        legacyRefs: {
          itemId: legacyItemId,
          itemSourceId: null,
        },
        rawMeta: item.rawMeta,
      },
    ] satisfies UnifiedContentRecord[];
  });
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
    const legacyItemIdBySourceItem = fullItems.reduce<Record<string, string>>(
      (accumulator, item) => {
        accumulator[buildPayloadKey(item.source, item.sourceItemId)] = item.id;
        return accumulator;
      },
      {},
    );
    const unifiedRecords = buildUnifiedContentRecords(
      sourcePipeline.feed,
      legacyItemIdBySourceItem,
    );
    await upsertUnifiedContentRecords(client, unifiedRecords);
    await logger.info("pipeline.persist.pg.upsertUnifiedContentRecords", {
      recordCount: unifiedRecords.length,
      sourceCount: replaceableSources.length,
    });

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
