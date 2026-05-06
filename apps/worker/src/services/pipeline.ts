import { createHash, randomUUID } from "node:crypto";
import type {
  NormalizedItem,
  RuntimeTopicSeed,
  RuntimeTopicSeedRun,
  SourceFeatures,
  SourceKey,
  SourceStatus,
  TopicCluster,
  TopicMembership,
  TopicNode,
  UnifiedContentRecord,
} from "@devtrend/contracts";
import {
  getLatestRuntimeTopicSeedSnapshot,
  getLatestSuccessfulSnapshot,
  getSourceStatusMap,
  insertRuntimeTopicSeedRun,
  insertSourceStatus,
  listActiveRuntimeTopicSeeds,
  listActiveTopicClusters,
  listAllNormalizedItems,
  listCatalogTopics,
  listEmbeddingBackfillCandidates,
  listEmbeddingRecords,
  listRuntimeTopicClusterSeeds,
  listUnifiedContentRecordsByCanonicalIds,
  markSupersededTopicClusters,
  recordCollectionArtifacts,
  replaceDerivedPipelineOutput,
  replaceRuntimeTopicSeeds,
  replaceSourceItems,
  replaceTopicClusterMemberships,
  replaceTopicMemberships,
  upsertCatalog,
  upsertEmbeddingRecord,
  upsertTopicCluster,
  upsertTopicLabelCandidate,
  upsertTopicLineage,
  upsertTopicNode,
  upsertUnifiedContentRecords,
  withTransaction,
} from "@devtrend/db";
import {
  buildEmbeddingInputFromUnifiedContent,
  buildFallbackTopicNaming,
  buildQuestionPressurePipeline,
  buildTaxonomyNodes,
  clusterTopicContents,
  entitySeeds,
  isValidSourceFeatures,
  parseTopicNamingLLMOutput,
  TOPIC_CLUSTER_RULE_VERSION,
  topicSeeds,
  validateTopicNamingCandidate,
} from "@devtrend/domain";
import type { CollectedSourcePayload } from "@devtrend/sources";
import {
  type CircuitBreakerStore,
  discoverRuntimeTopicCandidates,
  mergeRuntimeTopicCandidates,
  normalizeCollectedPayloads,
} from "@devtrend/sources";
import { Ollama } from "ollama";
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

export interface EmbeddingPipelineConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
}

export interface EmbeddingJobOptions {
  source?: SourceKey;
  limit?: number;
  includeFailed?: boolean;
}

export interface EmbeddingJobResult {
  candidates: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export interface TopicClusteringJobResult {
  embeddings: number;
  clusters: number;
  memberships: number;
  superseded: number;
}

export interface TopicNamingOllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface TopicNamingJobResult {
  clusters: number;
  llmGenerated: number;
  fallbackGenerated: number;
}

export type EmbeddingVectorGenerator = (
  config: EmbeddingPipelineConfig,
  input: string,
) => Promise<number[]>;

export type TopicNamingGenerator = (
  config: TopicNamingOllamaConfig,
  prompt: string,
) => Promise<unknown>;

const EMBEDDING_INPUT_SCHEMA_VERSION = "embedding-input-v1";
const DEFAULT_EMBEDDING_BATCH_LIMIT = 50;

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

function resolveEmbeddingLimit(value: number | undefined): number {
  if (typeof value !== "number") {
    return DEFAULT_EMBEDDING_BATCH_LIMIT;
  }
  return Math.max(1, Math.min(value, 500));
}

function resolveEmbeddingEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/embeddings`;
}

function parseEmbeddingVector(payload: unknown): number[] {
  if (!isObjectLike(payload) || !Array.isArray(payload.embedding)) {
    throw new Error("Embedding provider response does not include embedding.");
  }

  const vector = payload.embedding
    .map((value) => (typeof value === "number" ? value : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (vector.length === 0) {
    throw new Error("Embedding provider returned an empty vector.");
  }
  return vector;
}

export async function requestOllamaEmbedding(
  config: EmbeddingPipelineConfig,
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(resolveEmbeddingEndpoint(config.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt: input,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Embedding provider HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const vector = parseEmbeddingVector(payload);
    if (config.dimensions > 0 && vector.length !== config.dimensions) {
      throw new Error(
        `Embedding vector dimension mismatch: expected ${config.dimensions}, got ${vector.length}`,
      );
    }
    return vector;
  } finally {
    clearTimeout(timeout);
  }
}

function createTimeoutFetch(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(timeoutMs, 1000),
    );
    const upstreamSignal = init?.signal;
    const abortOnUpstreamSignal = () => controller.abort();

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        upstreamSignal.addEventListener("abort", abortOnUpstreamSignal, {
          once: true,
        });
      }
    }

    try {
      return await fetchImpl(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener("abort", abortOnUpstreamSignal);
    }
  };
}

export async function requestOllamaTopicNaming(
  config: TopicNamingOllamaConfig,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const client = new Ollama({
    host: config.baseUrl,
    fetch: createTimeoutFetch(config.timeoutMs, fetchImpl),
  });

  const response = await client.chat({
    model: config.model,
    think: false,
    stream: false,
    format: "json",
    messages: [
      {
        role: "system",
        content:
          "You are a topic naming assistant. Return only strict JSON with keys: label, summary, keywords, taxonomy{l1,l2,l3}.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.message.content.trim();
  if (content.length === 0) {
    throw new Error("Ollama naming response is empty.");
  }

  return content;
}

function topicNamingConfigAvailable(config: TopicNamingOllamaConfig): boolean {
  return config.baseUrl.trim().length > 0 && config.model.trim().length > 0;
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

async function runEmbeddingBatch(
  pool: Pool,
  config: EmbeddingPipelineConfig,
  options: EmbeddingJobOptions,
  logger: WorkerLogger,
  embed: EmbeddingVectorGenerator = requestOllamaEmbedding,
): Promise<EmbeddingJobResult> {
  const startedAt = Date.now();
  const limit = resolveEmbeddingLimit(options.limit);
  const candidates = await withTransaction(pool, (client) =>
    listEmbeddingBackfillCandidates(client, {
      source: options.source,
      model: config.model,
      inputSchemaVersion: EMBEDDING_INPUT_SCHEMA_VERSION,
      limit,
      includeFailed: options.includeFailed,
    }),
  );

  await logger.info("pipeline.embedding.batch.start", {
    source: options.source ?? null,
    limit,
    includeFailed: options.includeFailed === true,
    candidateCount: candidates.length,
  });

  if (candidates.length === 0) {
    return {
      candidates: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const candidateIds = candidates.map((candidate) => candidate.canonicalId);
  const recordList = await withTransaction(pool, (client) =>
    listUnifiedContentRecordsByCanonicalIds(client, candidateIds),
  );
  const recordByCanonicalId = new Map(
    recordList.map((record) => [record.canonicalId, record]),
  );

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const record = recordByCanonicalId.get(candidate.canonicalId);
    if (!record) {
      skipped += 1;
      await logger.warn("pipeline.embedding.record.skipped", {
        canonicalId: candidate.canonicalId,
        source: candidate.source,
        reason: "missing-unified-content",
      });
      continue;
    }

    const payload = buildEmbeddingInputFromUnifiedContent(record);
    if (!payload) {
      skipped += 1;
      await logger.warn("pipeline.embedding.record.skipped", {
        canonicalId: record.canonicalId,
        source: record.source,
        reason: "invalid-embedding-input",
      });
      continue;
    }

    processed += 1;
    try {
      const vector = await embed(config, payload.input);
      await withTransaction(pool, async (client) => {
        await upsertEmbeddingRecord(client, {
          canonicalId: record.canonicalId,
          source: record.source,
          contentFingerprint: record.fingerprint,
          inputSchemaVersion: EMBEDDING_INPUT_SCHEMA_VERSION,
          provider: "ollama",
          model: config.model,
          modelVersion: config.model,
          vector,
          metadata: {
            inputFingerprint: payload.inputFingerprint,
            generatedAt: new Date().toISOString(),
          },
        });
      });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      await logger.warn("pipeline.embedding.record.failed", {
        canonicalId: record.canonicalId,
        source: record.source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const result: EmbeddingJobResult = {
    candidates: candidates.length,
    processed,
    succeeded,
    failed,
    skipped,
  };
  await logger.info("pipeline.embedding.batch.done", {
    ...result,
    durationMs: Date.now() - startedAt,
  });
  return result;
}

export async function runIncrementalEmbeddingJob(
  pool: Pool,
  config: EmbeddingPipelineConfig,
  options: Omit<EmbeddingJobOptions, "includeFailed"> = {},
  logger: WorkerLogger = noopWorkerLogger(),
  embed: EmbeddingVectorGenerator = requestOllamaEmbedding,
): Promise<EmbeddingJobResult> {
  return runEmbeddingBatch(
    pool,
    config,
    { ...options, includeFailed: false },
    logger,
    embed,
  );
}

export async function runEmbeddingBackfillJob(
  pool: Pool,
  config: EmbeddingPipelineConfig,
  options: EmbeddingJobOptions = {},
  logger: WorkerLogger = noopWorkerLogger(),
  embed: EmbeddingVectorGenerator = requestOllamaEmbedding,
): Promise<EmbeddingJobResult> {
  return runEmbeddingBatch(pool, config, options, logger, embed);
}

async function persistTopicClusters(
  pool: Pool,
  clusters: ReturnType<typeof clusterTopicContents>,
): Promise<
  Pick<TopicClusteringJobResult, "clusters" | "memberships" | "superseded">
> {
  return withTransaction(pool, async (client) => {
    let memberships = 0;
    const batchTopicClusterIds: string[] = [];
    const keepRowIds: string[] = [];

    for (const result of clusters) {
      const persisted = await upsertTopicCluster(client, result.cluster);
      await replaceTopicClusterMemberships(client, {
        topicClusterRowId: persisted.rowId,
        memberships: result.memberships,
      });
      batchTopicClusterIds.push(result.cluster.topicClusterId);
      keepRowIds.push(persisted.rowId);
      memberships += result.memberships.length;
    }

    const superseded = await markSupersededTopicClusters(client, {
      ruleVersion: TOPIC_CLUSTER_RULE_VERSION,
      batchTopicClusterIds,
      keepRowIds,
    });

    return {
      clusters: clusters.length,
      memberships,
      superseded,
    };
  });
}

async function runTopicClusteringBatch(
  pool: Pool,
  config: EmbeddingPipelineConfig,
  options: {
    source?: SourceKey;
    limit?: number;
  } = {},
  logger: WorkerLogger,
): Promise<TopicClusteringJobResult> {
  const limit = resolveEmbeddingLimit(options.limit);
  const embeddings = await withTransaction(pool, (client) =>
    listEmbeddingRecords(client, {
      source: options.source,
      model: config.model,
      status: "succeeded",
      limit,
    }),
  );

  await logger.info("pipeline.topic-clustering.batch.start", {
    source: options.source ?? null,
    limit,
    embeddingCount: embeddings.length,
  });

  if (embeddings.length === 0) {
    return {
      embeddings: 0,
      clusters: 0,
      memberships: 0,
      superseded: 0,
    };
  }

  const canonicalIds = [
    ...new Set(embeddings.map((embedding) => embedding.canonicalId)),
  ];
  const records = await withTransaction(pool, (client) =>
    listUnifiedContentRecordsByCanonicalIds(client, canonicalIds),
  );
  const recordByCanonicalId = new Map(
    records.map((record) => [record.canonicalId, record]),
  );
  const clusteringInputs = embeddings.flatMap((embedding) => {
    const record = recordByCanonicalId.get(embedding.canonicalId);
    if (!record) {
      return [];
    }
    return [
      {
        embeddingId: embedding.id,
        vector: embedding.vector,
        content: record,
      },
    ];
  });

  const clusters = clusterTopicContents(clusteringInputs);
  const persisted = await persistTopicClusters(pool, clusters);
  await logger.info("pipeline.topic-clustering.batch.done", {
    embeddings: clusteringInputs.length,
    clusters: persisted.clusters,
    memberships: persisted.memberships,
    superseded: persisted.superseded,
  });

  return {
    embeddings: clusteringInputs.length,
    clusters: persisted.clusters,
    memberships: persisted.memberships,
    superseded: persisted.superseded,
  };
}

export async function runTopicClusteringJob(
  pool: Pool,
  config: EmbeddingPipelineConfig,
  options: {
    source?: SourceKey;
    limit?: number;
  } = {},
  logger: WorkerLogger = noopWorkerLogger(),
): Promise<TopicClusteringJobResult> {
  return runTopicClusteringBatch(pool, config, options, logger);
}

export async function runTopicClusteringBackfillJob(
  pool: Pool,
  config: EmbeddingPipelineConfig,
  options: {
    source?: SourceKey;
    limit?: number;
  } = {},
  logger: WorkerLogger = noopWorkerLogger(),
): Promise<TopicClusteringJobResult> {
  return runTopicClusteringBatch(pool, config, options, logger);
}

function buildTopicNamingPrompt(cluster: TopicCluster): string {
  const evidence = cluster.representativeEvidence
    .map((item) => `${item.source}: ${item.title}`)
    .slice(0, 4);
  const payload = {
    clusterId: cluster.topicClusterId,
    displayName: cluster.displayName,
    summary: cluster.summary,
    keywords: cluster.keywords,
    relatedRepos: cluster.relatedRepos,
    relatedEntities: cluster.relatedEntities,
    sourceMix: cluster.sourceMix,
    representativeEvidence: evidence,
  };
  return JSON.stringify(payload);
}

function deriveTopicMemberships(
  topicClusterId: string,
  clusterVersion: string,
  nodeIds: string[],
): TopicMembership[] {
  if (nodeIds.length === 0) {
    return [];
  }

  const leafId = nodeIds[nodeIds.length - 1] ?? nodeIds[0];
  return nodeIds.map((topicId) => ({
    topicClusterId,
    clusterVersion,
    topicId,
    membershipRole: topicId === leafId ? "primary" : "supporting",
    confidence: topicId === leafId ? 1 : 0.85,
    metadata: {
      source: "topic-naming",
    },
  }));
}

async function runTopicNamingBatch(
  pool: Pool,
  config: TopicNamingOllamaConfig,
  options: {
    source?: SourceKey;
    limit?: number;
  } = {},
  logger: WorkerLogger,
  generate: TopicNamingGenerator = requestOllamaTopicNaming,
): Promise<TopicNamingJobResult> {
  const clusters = await withTransaction(pool, async (client) => {
    const rows = await listActiveTopicClusters(client, {
      limit: resolveEmbeddingLimit(options.limit),
    });
    if (!options.source) {
      return rows;
    }
    return rows.filter((row) =>
      row.sourceMix.some((mix) => mix.source === options.source),
    );
  });

  await logger.info("pipeline.topic-naming.batch.start", {
    source: options.source ?? null,
    limit: options.limit ?? DEFAULT_EMBEDDING_BATCH_LIMIT,
    clusterCount: clusters.length,
  });

  let llmGenerated = 0;
  let fallbackGenerated = 0;

  for (const cluster of clusters) {
    let namingCandidate = buildFallbackTopicNaming(cluster, "low-quality");
    const prompt = buildTopicNamingPrompt(cluster);
    const metadata: Record<string, unknown> = {
      clusterVersion: cluster.clusterVersion,
      promptSize: prompt.length,
    };

    if (!topicNamingConfigAvailable(config)) {
      namingCandidate = buildFallbackTopicNaming(cluster, "missing-config");
    } else {
      try {
        const llmPayload = await generate(config, prompt);
        const parsed = parseTopicNamingLLMOutput(llmPayload);
        const validated = parsed
          ? validateTopicNamingCandidate(
              cluster,
              parsed,
              "ollama",
              config.model,
            )
          : null;

        if (validated) {
          namingCandidate = validated;
          llmGenerated += 1;
          metadata.llmResult = "accepted";
        } else {
          namingCandidate = buildFallbackTopicNaming(
            cluster,
            "invalid-response",
          );
          metadata.llmResult = "invalid-response";
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const reason = message.includes("aborted")
          ? "provider-timeout"
          : "provider-error";
        namingCandidate = buildFallbackTopicNaming(cluster, reason);
        metadata.llmResult = reason;
        metadata.error = message;
      }
    }

    if (namingCandidate.status !== "llm-generated") {
      fallbackGenerated += 1;
    }

    await withTransaction(pool, async (client) => {
      const candidate = await upsertTopicLabelCandidate(client, {
        topicClusterId: cluster.topicClusterId,
        clusterVersion: cluster.clusterVersion,
        status: namingCandidate.status,
        label: namingCandidate.label,
        summary: namingCandidate.summary,
        keywords: namingCandidate.keywords,
        taxonomyL1: namingCandidate.taxonomyL1,
        taxonomyL2: namingCandidate.taxonomyL2,
        taxonomyL3: namingCandidate.taxonomyL3,
        fallbackReason: namingCandidate.fallbackReason,
        provider: namingCandidate.provider,
        model: namingCandidate.model,
        metadata: {
          ...namingCandidate.metadata,
          ...metadata,
        },
      });

      const nodes = buildTaxonomyNodes(namingCandidate);
      const persistedNodes: TopicNode[] = [];
      let parentTopicId: string | undefined;
      for (const node of nodes) {
        const persisted = await upsertTopicNode(client, {
          slug: node.slug,
          displayName: node.displayName,
          level: node.level,
          parentTopicId,
          source: node.source,
          metadata: {
            topicClusterId: cluster.topicClusterId,
            clusterVersion: cluster.clusterVersion,
          },
        });
        persistedNodes.push(persisted);
        parentTopicId = persisted.id;
      }

      const l1 = persistedNodes.find((entry) => entry.level === "l1");
      const l2 = persistedNodes.find((entry) => entry.level === "l2");
      const l3 = persistedNodes.find((entry) => entry.level === "l3");
      if (!l1) {
        throw new Error("Topic naming must always persist an L1 topic node.");
      }

      await upsertTopicLineage(client, {
        topicClusterId: cluster.topicClusterId,
        clusterVersion: cluster.clusterVersion,
        labelCandidateId: candidate.id,
        l1TopicId: l1.id,
        l2TopicId: l2?.id,
        l3TopicId: l3?.id,
        pathSlugs: persistedNodes.map((node) => node.slug),
        metadata: {
          namingStatus: namingCandidate.status,
        },
      });

      const memberships = deriveTopicMemberships(
        cluster.topicClusterId,
        cluster.clusterVersion,
        persistedNodes.map((entry) => entry.id),
      );
      await replaceTopicMemberships(client, {
        topicClusterId: cluster.topicClusterId,
        clusterVersion: cluster.clusterVersion,
        memberships,
      });
    });
  }

  const result: TopicNamingJobResult = {
    clusters: clusters.length,
    llmGenerated,
    fallbackGenerated,
  };
  await logger.info("pipeline.topic-naming.batch.done", { ...result });
  return result;
}

export async function runTopicNamingJob(
  pool: Pool,
  config: TopicNamingOllamaConfig,
  options: {
    source?: SourceKey;
    limit?: number;
  } = {},
  logger: WorkerLogger = noopWorkerLogger(),
  generate: TopicNamingGenerator = requestOllamaTopicNaming,
): Promise<TopicNamingJobResult> {
  return runTopicNamingBatch(pool, config, options, logger, generate);
}

export async function runTopicNamingBackfillJob(
  pool: Pool,
  config: TopicNamingOllamaConfig,
  options: {
    source?: SourceKey;
    limit?: number;
  } = {},
  logger: WorkerLogger = noopWorkerLogger(),
  generate: TopicNamingGenerator = requestOllamaTopicNaming,
): Promise<TopicNamingJobResult> {
  return runTopicNamingBatch(pool, config, options, logger, generate);
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
  logger: WorkerLogger = noopWorkerLogger(),
): Promise<RuntimeTopicSeed[]> {
  return withTransaction(pool, async (client) => {
    const dynamicTopics = await listRuntimeTopicClusterSeeds(client);
    if (dynamicTopics.length > 0) {
      await logger.info("pipeline.runtime-topics.load.dynamic", {
        topics: dynamicTopics.length,
        fallbackReason: null,
      });
      return dynamicTopics;
    }

    const activeClusters = await listActiveTopicClusters(client, { limit: 1 });
    const fallbackReason =
      activeClusters[0]?.runtimeFallbackReason ?? "missing-cluster";
    const fallbackTopics = await listActiveRuntimeTopicSeeds(client);
    await logger.warn("pipeline.runtime-topics.load.fallback", {
      topics: fallbackTopics.length,
      fallbackReason,
    });
    return fallbackTopics;
  });
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
