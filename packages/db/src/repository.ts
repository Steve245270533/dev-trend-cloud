import { randomUUID } from "node:crypto";
import type {
  EmbeddingProvider,
  FeedItem,
  FeedQuery,
  MatchedEntity,
  MatchedTopic,
  NormalizedItem,
  QuestionCluster,
  QuestionEvidence,
  QuestionPressureQuery,
  QuestionPressureSignal,
  RuntimeTopicFallbackReason,
  RuntimeTopicSeed,
  RuntimeTopicSeedRun,
  SourceStatus,
  TopicCluster,
  TopicClusterMembership,
  TopicLabelCandidate,
  TopicLineage,
  TopicMembership,
  TopicNamingFallbackReason,
  TopicNamingStatus,
  TopicNode,
  UnifiedContentRecord,
} from "@devtrend/contracts";
import type { PipelineOutput } from "@devtrend/domain";
import type { CollectedSourcePayload } from "@devtrend/sources";
import type { Queryable } from "./client.js";

interface ItemRow {
  id: string;
  source: string;
  source_item_id: string;
  title: string;
  summary: string;
  url: string;
  author: string | null;
  published_at: string;
  score: number;
  answer_count: number;
  comment_count: number;
  tags: string[];
  content_type: string;
  is_question: boolean;
  raw_meta: Record<string, unknown>;
}

interface UnifiedContentRow {
  canonical_id: string;
  source: string;
  source_item_id: string;
  title: string;
  summary: string;
  body_excerpt: string | null;
  url: string;
  author: string | null;
  published_at: string;
  collected_at: string;
  timestamp_origin: string;
  tags: string[];
  source_features: Record<string, unknown>;
  fingerprint: string;
  evidence_refs: string[];
  legacy_item_id: string;
  legacy_item_source_id: string | null;
  raw_meta: Record<string, unknown>;
}

interface CollectionArtifactRef {
  sourceRunId: string;
  snapshotId: string | null;
  collectedAt: string;
  fallbackUsed: boolean;
}

interface FallbackSnapshotRecord {
  sourceRunId: string;
  snapshotId: string;
  collectedAt: string;
  payload: Record<string, unknown>[];
}

interface RuntimeTopicSeedRow {
  run_id: string;
  slug: string;
  name: string;
  keywords: string[];
  source_priority: number;
  sources: unknown;
  collection_id: string | null;
  devto_tags: string[];
  score: number;
  active: boolean;
  refreshed_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

export interface WorkerBootstrapState {
  hasActiveRuntimeTopicSnapshot: boolean;
  hasPersistedItems: boolean;
}

export interface UnifiedModelCompatibilityReport {
  legacyItemMissingCount: number;
  legacyItemSourceMissingCount: number;
  sourceMismatchCount: number;
  sourceItemIdMismatchCount: number;
}

export type EmbeddingStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "superseded";

interface EmbeddingRow {
  id: string;
  canonical_id: string;
  source: string;
  content_fingerprint: string;
  input_schema_version: string;
  provider: string;
  model: string;
  model_version: string;
  dimensions: number;
  embedding_vector_text: string;
  status: EmbeddingStatus;
  error_text: string | null;
  retry_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  succeeded_at: string | null;
}

interface TopicClusterRow {
  id: string;
  topic_cluster_id: string;
  stable_key: string;
  cluster_version: string;
  rule_version: string;
  status: string;
  slug: string;
  display_name: string;
  summary: string;
  keywords: string[];
  anchor_canonical_id: string;
  representative_evidence: unknown;
  source_mix: unknown;
  related_repos: string[];
  related_entities: string[];
  item_count: number;
  cluster_confidence: number;
  runtime_fallback_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface TopicClusterMembershipRow {
  topic_cluster_id: string;
  cluster_version: string;
  canonical_id: string;
  item_id: string;
  embedding_record_id: string | null;
  source: string;
  membership_confidence: number;
  primary_evidence: boolean;
  evidence_rank: number;
  reasoning_tags: string[];
  metadata: Record<string, unknown>;
}

interface TopicLabelCandidateRow {
  id: string;
  topic_cluster_id: string;
  cluster_version: string;
  status: string;
  label: string;
  summary: string;
  keywords: string[];
  taxonomy_l1: string;
  taxonomy_l2: string | null;
  taxonomy_l3: string | null;
  fallback_reason: string | null;
  provider: string | null;
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface TopicNodeRow {
  id: string;
  slug: string;
  display_name: string;
  level: string;
  parent_topic_id: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface TopicLineageRow {
  id: string;
  topic_cluster_id: string;
  cluster_version: string;
  label_candidate_id: string;
  l1_topic_id: string;
  l2_topic_id: string | null;
  l3_topic_id: string | null;
  path_slugs: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface TopicMembershipRow {
  topic_cluster_id: string;
  cluster_version: string;
  topic_node_id: string;
  membership_role: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface EmbeddingRecordPersisted {
  id: string;
  canonicalId: string;
  source: UnifiedContentRecord["source"];
  contentFingerprint: string;
  inputSchemaVersion: string;
  provider: EmbeddingProvider;
  model: string;
  modelVersion: string;
  dimensions: number;
  vector: number[];
  status: EmbeddingStatus;
  errorText: string | null;
  retryCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  succeededAt: string | null;
}

export interface UpsertEmbeddingRecordInput {
  canonicalId: string;
  source: UnifiedContentRecord["source"];
  contentFingerprint: string;
  inputSchemaVersion: string;
  provider: EmbeddingProvider;
  model: string;
  modelVersion: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface ListEmbeddingRecordsQuery {
  canonicalId?: string;
  source?: UnifiedContentRecord["source"];
  model?: string;
  status?: EmbeddingStatus;
  limit?: number;
}

export interface ListEmbeddingBackfillQuery {
  source?: UnifiedContentRecord["source"];
  model: string;
  inputSchemaVersion: string;
  limit?: number;
  includeFailed?: boolean;
}

export interface EmbeddingBackfillCandidate {
  canonicalId: string;
  source: UnifiedContentRecord["source"];
  contentFingerprint: string;
  collectedAt: string;
}

export interface UpdateEmbeddingStatusInput {
  id: string;
  status: Exclude<EmbeddingStatus, "superseded">;
  errorText?: string | null;
  retryCount?: number;
}

export interface TopicClusterPersisted extends TopicCluster {
  rowId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertTopicClusterInput extends TopicCluster {}

export interface ReplaceTopicClusterMembershipsInput {
  topicClusterRowId: string;
  memberships: TopicClusterMembership[];
}

export interface UpsertTopicLabelCandidateInput {
  topicClusterId: string;
  clusterVersion: string;
  status: TopicNamingStatus;
  label: string;
  summary: string;
  keywords: string[];
  taxonomyL1: string;
  taxonomyL2?: string;
  taxonomyL3?: string;
  fallbackReason?: TopicNamingFallbackReason;
  provider?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertTopicNodeInput {
  slug: string;
  displayName: string;
  level: TopicNode["level"];
  parentTopicId?: string;
  source: TopicNode["source"];
  metadata?: Record<string, unknown>;
}

export interface UpsertTopicLineageInput {
  topicClusterId: string;
  clusterVersion: string;
  labelCandidateId: string;
  l1TopicId: string;
  l2TopicId?: string;
  l3TopicId?: string;
  pathSlugs: string[];
  metadata?: Record<string, unknown>;
}

export interface ReplaceTopicMembershipsInput {
  topicClusterId: string;
  clusterVersion: string;
  memberships: TopicMembership[];
}

type PersistedSourceStatus = SourceStatus & {
  metadata?: Record<string, unknown>;
};

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeEmbeddingVector(vector: number[]): number[] {
  return vector.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding vector contains non-finite values.");
    }
    return value;
  });
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

function parseVectorText(text: string): number[] {
  const normalized = text.trim();
  if (!normalized.startsWith("[") || !normalized.endsWith("]")) {
    return [];
  }

  const payload = normalized.slice(1, -1).trim();
  if (payload.length === 0) {
    return [];
  }

  return payload
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function canonicalKey(item: NormalizedItem): string {
  return item.title
    .toLowerCase()
    .replaceAll(/[^a-z0-9 ]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function buildArtifactKey(source: string, commandName: string): string {
  return `${source}:${commandName}`;
}

function mapRuntimeTopicSeedRow(row: RuntimeTopicSeedRow): RuntimeTopicSeed {
  return {
    runId: row.run_id,
    slug: row.slug,
    name: row.name,
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
    sourcePriority: Number(row.source_priority ?? 0),
    sources: Array.isArray(row.sources)
      ? row.sources.map(
          (value) => String(value) as RuntimeTopicSeed["sources"][number],
        )
      : [],
    collectionId:
      typeof row.collection_id === "string" ? row.collection_id : undefined,
    devtoTags: Array.isArray(row.devto_tags) ? row.devto_tags.map(String) : [],
    score: Number(row.score ?? 0),
    active: row.active === true,
    refreshedAt: new Date(row.refreshed_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    metadata: row.metadata ?? {},
  };
}

async function getItemTopics(
  db: Queryable,
  itemId: string,
): Promise<MatchedTopic[]> {
  const result = await db.query(
    `
      SELECT t.id, t.slug, t.name, it.confidence, it.matched_keywords
      FROM item_topics it
      JOIN topics t ON t.id = it.topic_id
      WHERE it.item_id = $1
      ORDER BY it.confidence DESC
    `,
    [itemId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    confidence: Number(row.confidence),
    matchedKeywords: Array.isArray(row.matched_keywords)
      ? row.matched_keywords.map(String)
      : [],
  }));
}

async function getItemEntities(
  db: Queryable,
  itemId: string,
): Promise<MatchedEntity[]> {
  const result = await db.query(
    `
      SELECT e.id, e.slug, e.name, e.entity_type, ie.confidence, ie.matched_keywords, ie.repo_name
      FROM item_entities ie
      JOIN entities e ON e.id = ie.entity_id
      WHERE ie.item_id = $1
      ORDER BY ie.confidence DESC
    `,
    [itemId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    entityType: String(row.entity_type),
    confidence: Number(row.confidence),
    matchedKeywords: Array.isArray(row.matched_keywords)
      ? row.matched_keywords.map(String)
      : [],
    repoName: typeof row.repo_name === "string" ? row.repo_name : undefined,
  }));
}

function mapItemRow(row: ItemRow): NormalizedItem {
  const collectedAt =
    typeof row.raw_meta?.collectedAt === "string"
      ? row.raw_meta.collectedAt
      : new Date(row.published_at).toISOString();
  const timestampOrigin =
    row.raw_meta?.timestampOrigin === "collected" ? "collected" : "source";

  return {
    id: row.id,
    source: row.source as NormalizedItem["source"],
    sourceItemId: row.source_item_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    author: row.author ?? undefined,
    publishedAt: new Date(row.published_at).toISOString(),
    collectedAt,
    timestampOrigin,
    score: Number(row.score),
    answerCount: row.answer_count,
    commentCount: row.comment_count,
    tags: row.tags ?? [],
    contentType: row.content_type,
    isQuestion: row.is_question,
    rawMeta: row.raw_meta ?? {},
  };
}

function normalizeSourceFeatures(
  value: unknown,
): UnifiedContentRecord["sourceFeatures"] {
  if (!isObjectLike(value)) {
    return { shared: {} };
  }

  const features = value as Record<string, unknown>;
  const shared = isObjectLike(features.shared) ? features.shared : {};
  return {
    ...features,
    shared,
  } as UnifiedContentRecord["sourceFeatures"];
}

function mapUnifiedContentRow(row: UnifiedContentRow): UnifiedContentRecord {
  return {
    canonicalId: row.canonical_id,
    source: row.source as UnifiedContentRecord["source"],
    sourceItemId: row.source_item_id,
    title: row.title,
    summary: row.summary,
    bodyExcerpt: row.body_excerpt ?? undefined,
    url: row.url,
    author: row.author ?? undefined,
    publishedAt: new Date(row.published_at).toISOString(),
    collectedAt: new Date(row.collected_at).toISOString(),
    timestampOrigin:
      row.timestamp_origin === "collected" ? "collected" : "source",
    tags: row.tags ?? [],
    sourceFeatures: normalizeSourceFeatures(row.source_features),
    fingerprint: row.fingerprint,
    evidenceRefs: row.evidence_refs ?? [],
    legacyRefs: {
      itemId: row.legacy_item_id,
      itemSourceId: row.legacy_item_source_id,
    },
    rawMeta: row.raw_meta ?? {},
  };
}

function mapEmbeddingRow(row: EmbeddingRow): EmbeddingRecordPersisted {
  return {
    id: row.id,
    canonicalId: row.canonical_id,
    source: row.source as UnifiedContentRecord["source"],
    contentFingerprint: row.content_fingerprint,
    inputSchemaVersion: row.input_schema_version,
    provider: row.provider as EmbeddingProvider,
    model: row.model,
    modelVersion: row.model_version,
    dimensions: Number(row.dimensions),
    vector: parseVectorText(row.embedding_vector_text),
    status: row.status,
    errorText: row.error_text,
    retryCount: Number(row.retry_count),
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    succeededAt: row.succeeded_at
      ? new Date(row.succeeded_at).toISOString()
      : null,
  };
}

function mapTopicClusterRow(row: TopicClusterRow): TopicClusterPersisted {
  return {
    rowId: row.id,
    topicClusterId: row.topic_cluster_id,
    stableKey: row.stable_key,
    clusterVersion: row.cluster_version,
    ruleVersion: row.rule_version,
    status: row.status as TopicCluster["status"],
    slug: row.slug,
    displayName: row.display_name,
    summary: row.summary,
    keywords: row.keywords ?? [],
    anchorCanonicalId: row.anchor_canonical_id,
    representativeEvidence: Array.isArray(row.representative_evidence)
      ? row.representative_evidence.map(
          (entry) => entry as TopicCluster["representativeEvidence"][number],
        )
      : [],
    sourceMix: Array.isArray(row.source_mix)
      ? row.source_mix.map(
          (entry) => entry as TopicCluster["sourceMix"][number],
        )
      : [],
    relatedRepos: row.related_repos ?? [],
    relatedEntities: row.related_entities ?? [],
    itemCount: Number(row.item_count ?? 0),
    clusterConfidence: Number(row.cluster_confidence ?? 0),
    runtimeFallbackReason:
      typeof row.runtime_fallback_reason === "string"
        ? (row.runtime_fallback_reason as RuntimeTopicFallbackReason)
        : undefined,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapTopicClusterMembershipRow(
  row: TopicClusterMembershipRow,
): TopicClusterMembership {
  return {
    topicClusterId: row.topic_cluster_id,
    clusterVersion: row.cluster_version,
    canonicalId: row.canonical_id,
    itemId: row.item_id,
    embeddingRecordId: row.embedding_record_id ?? undefined,
    source: row.source as TopicClusterMembership["source"],
    membershipConfidence: Number(row.membership_confidence ?? 0),
    primaryEvidence: row.primary_evidence === true,
    evidenceRank: Number(row.evidence_rank ?? 1),
    reasoningTags: row.reasoning_tags ?? [],
    metadata: row.metadata ?? {},
  };
}

function mapTopicLabelCandidateRow(
  row: TopicLabelCandidateRow,
): TopicLabelCandidate {
  return {
    id: row.id,
    topicClusterId: row.topic_cluster_id,
    clusterVersion: row.cluster_version,
    status: row.status as TopicNamingStatus,
    label: row.label,
    summary: row.summary,
    keywords: row.keywords ?? [],
    taxonomyL1: row.taxonomy_l1,
    taxonomyL2: row.taxonomy_l2 ?? undefined,
    taxonomyL3: row.taxonomy_l3 ?? undefined,
    fallbackReason:
      typeof row.fallback_reason === "string"
        ? (row.fallback_reason as TopicNamingFallbackReason)
        : undefined,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapTopicNodeRow(row: TopicNodeRow): TopicNode {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    level: row.level as TopicNode["level"],
    parentTopicId: row.parent_topic_id ?? undefined,
    source: row.source as TopicNode["source"],
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapTopicLineageRow(row: TopicLineageRow): TopicLineage {
  return {
    id: row.id,
    topicClusterId: row.topic_cluster_id,
    clusterVersion: row.cluster_version,
    labelCandidateId: row.label_candidate_id,
    l1TopicId: row.l1_topic_id,
    l2TopicId: row.l2_topic_id ?? undefined,
    l3TopicId: row.l3_topic_id ?? undefined,
    pathSlugs: row.path_slugs ?? [],
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapTopicMembershipRow(row: TopicMembershipRow): TopicMembership {
  return {
    topicClusterId: row.topic_cluster_id,
    clusterVersion: row.cluster_version,
    topicId: row.topic_node_id,
    membershipRole: row.membership_role as TopicMembership["membershipRole"],
    confidence: Number(row.confidence ?? 0),
    metadata: row.metadata ?? {},
  };
}

export async function pingDatabase(db: Queryable): Promise<boolean> {
  await db.query("SELECT 1");
  return true;
}

export async function resetRuntimeTables(db: Queryable) {
  await db.query(
    `
      TRUNCATE TABLE
        topic_memberships,
        topic_lineage,
        topic_label_candidates,
        topic_nodes,
        topic_cluster_memberships,
        topic_clusters,
        embedding_records,
        unified_contents,
        signal_evidence,
        signals,
        question_cluster_items,
        question_clusters,
        item_entities,
        item_topics,
        item_sources,
        items
      RESTART IDENTITY CASCADE
    `,
  );
}

export async function resetSeedTables(db: Queryable) {
  await db.query(
    `
      TRUNCATE TABLE
        topic_memberships,
        topic_lineage,
        topic_label_candidates,
        topic_nodes,
        topic_cluster_memberships,
        topic_clusters,
        embedding_records,
        unified_contents,
        runtime_topic_seeds,
        runtime_topic_seed_runs,
        signal_evidence,
        signals,
        question_cluster_items,
        question_clusters,
        item_entities,
        item_topics,
        item_sources,
        items,
        watchlist_events,
        watchlists,
        raw_snapshots,
        source_runs,
        topics,
        entities,
        source_health
      RESTART IDENTITY CASCADE
    `,
  );
}

export async function listCatalogTopics(
  db: Queryable,
): Promise<RuntimeTopicSeed[]> {
  const result = await db.query(
    `
      SELECT
        '00000000-0000-5000-8000-000000000000'::text AS run_id,
        slug,
        name,
        keywords,
        10 AS source_priority,
        '["fallback-topics"]'::jsonb AS sources,
        NULL::text AS collection_id,
        '{}'::text[] AS devto_tags,
        10::double precision AS score,
        TRUE AS active,
        NOW()::text AS refreshed_at,
        (NOW() + INTERVAL '2 hours')::text AS expires_at,
        jsonb_build_object('fallback', TRUE, 'source', 'topics') AS metadata
      FROM topics
      ORDER BY slug ASC
    `,
  );

  return result.rows.map((row: unknown) =>
    mapRuntimeTopicSeedRow(row as RuntimeTopicSeedRow),
  );
}

export async function recordCollectionArtifacts(
  db: Queryable,
  payloads: CollectedSourcePayload[],
): Promise<Record<string, CollectionArtifactRef>> {
  const artifacts: Record<string, CollectionArtifactRef> = {};

  for (const payload of payloads) {
    const sourceRunId = randomUUID();
    let snapshotId: string | null = null;
    let collectedAt = payload.finishedAt;
    const fallbackUsed = payload.status === "fallback";

    await db.query(
      `
        INSERT INTO source_runs (
          id,
          source,
          command,
          status,
          started_at,
          finished_at,
          error_text,
          fallback_used,
          records_count,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        sourceRunId,
        payload.source,
        payload.commandName,
        payload.status,
        payload.startedAt,
        payload.finishedAt,
        payload.errorText,
        fallbackUsed,
        payload.payload.length,
        JSON.stringify({
          argv: payload.argv,
          helpOutput: payload.helpOutput,
          fallbackSourceRunId: payload.fallbackSourceRunId ?? null,
          fallbackSnapshotId: payload.fallbackSnapshotId ?? null,
          fallbackCollectedAt: payload.fallbackCollectedAt ?? null,
        }),
      ],
    );

    if (payload.status === "success") {
      snapshotId = randomUUID();
      collectedAt = payload.finishedAt;

      await db.query(
        `
          INSERT INTO raw_snapshots (
            id,
            source_run_id,
            source,
            command,
            snapshot_key,
            payload,
            collected_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          snapshotId,
          sourceRunId,
          payload.source,
          payload.commandName,
          `${payload.source}:${payload.commandName}:${payload.finishedAt}`,
          JSON.stringify(payload.payload),
          payload.finishedAt,
        ],
      );
    }

    if (payload.status === "fallback") {
      snapshotId = payload.fallbackSnapshotId ?? null;
      collectedAt = payload.fallbackCollectedAt ?? payload.finishedAt;
    }

    artifacts[buildArtifactKey(payload.source, payload.commandName)] = {
      sourceRunId,
      snapshotId,
      collectedAt,
      fallbackUsed,
    };
  }

  return artifacts;
}

export async function upsertCatalog(
  db: Queryable,
  topics: {
    id: string;
    slug: string;
    name: string;
    keywords: string[];
    repoPatterns: string[];
  }[],
  entities: {
    id: string;
    slug: string;
    name: string;
    entityType: string;
    aliases: string[];
    repos: string[];
  }[],
) {
  for (const topic of topics) {
    await db.query(
      `
        INSERT INTO topics (id, slug, name, keywords, repo_patterns)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            keywords = EXCLUDED.keywords,
            repo_patterns = EXCLUDED.repo_patterns
      `,
      [topic.id, topic.slug, topic.name, topic.keywords, topic.repoPatterns],
    );
  }

  for (const entity of entities) {
    await db.query(
      `
        INSERT INTO entities (id, slug, name, entity_type, aliases, repos)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            entity_type = EXCLUDED.entity_type,
            aliases = EXCLUDED.aliases,
            repos = EXCLUDED.repos
      `,
      [
        entity.id,
        entity.slug,
        entity.name,
        entity.entityType,
        entity.aliases,
        entity.repos,
      ],
    );
  }
}

export async function insertRuntimeTopicSeedRun(
  db: Queryable,
  run: RuntimeTopicSeedRun,
) {
  await db.query(
    `
      INSERT INTO runtime_topic_seed_runs (
        id,
        status,
        started_at,
        finished_at,
        fallback_used,
        error_text,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      run.id,
      run.status,
      run.startedAt,
      run.finishedAt,
      run.fallbackUsed,
      run.errorText,
      JSON.stringify(run.metadata),
    ],
  );
}

export async function replaceRuntimeTopicSeeds(
  db: Queryable,
  runId: string,
  seeds: RuntimeTopicSeed[],
) {
  await db.query(
    "UPDATE runtime_topic_seeds SET active = FALSE WHERE active = TRUE",
  );

  for (const seed of seeds) {
    await db.query(
      `
        INSERT INTO runtime_topic_seeds (
          run_id,
          slug,
          name,
          keywords,
          source_priority,
          sources,
          collection_id,
          devto_tags,
          score,
          active,
          refreshed_at,
          expires_at,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        runId,
        seed.slug,
        seed.name,
        seed.keywords,
        seed.sourcePriority,
        JSON.stringify(seed.sources),
        seed.collectionId ?? null,
        seed.devtoTags,
        seed.score,
        seed.active,
        seed.refreshedAt,
        seed.expiresAt,
        JSON.stringify(seed.metadata),
      ],
    );
  }
}

export async function getLatestRuntimeTopicSeedSnapshot(
  db: Queryable,
): Promise<RuntimeTopicSeed[]> {
  const latestRun = await db.query(
    `
      SELECT run_id
      FROM runtime_topic_seeds
      ORDER BY refreshed_at DESC, created_at DESC
      LIMIT 1
    `,
  );
  const row = latestRun.rows[0] as Record<string, unknown> | undefined;

  if (!row || typeof row.run_id !== "string") {
    return [];
  }

  const result = await db.query(
    `
      SELECT
        run_id,
        slug,
        name,
        keywords,
        source_priority,
        sources,
        collection_id,
        devto_tags,
        score,
        active,
        refreshed_at,
        expires_at,
        metadata
      FROM runtime_topic_seeds
      WHERE run_id = $1
      ORDER BY score DESC, slug ASC
    `,
    [row.run_id],
  );

  return result.rows.map((seedRow: unknown) =>
    mapRuntimeTopicSeedRow(seedRow as RuntimeTopicSeedRow),
  );
}

export async function listActiveRuntimeTopicSeeds(
  db: Queryable,
): Promise<RuntimeTopicSeed[]> {
  const result = await db.query(
    `
      SELECT
        run_id,
        slug,
        name,
        keywords,
        source_priority,
        sources,
        collection_id,
        devto_tags,
        score,
        active,
        refreshed_at,
        expires_at,
        metadata
      FROM runtime_topic_seeds
      WHERE active = TRUE
        AND expires_at > NOW()
      ORDER BY score DESC, slug ASC
    `,
  );

  if (result.rows.length > 0) {
    return result.rows.map((row: unknown) =>
      mapRuntimeTopicSeedRow(row as RuntimeTopicSeedRow),
    );
  }

  return listCatalogTopics(db);
}

export async function getWorkerBootstrapState(
  db: Queryable,
): Promise<WorkerBootstrapState> {
  const [runtimeTopicResult, itemResult] = await Promise.all([
    db.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM runtime_topic_seeds
          WHERE active = TRUE
            AND expires_at > NOW()
        ) AS has_active_runtime_topic_snapshot
      `,
    ),
    db.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM items
        ) AS has_persisted_items
      `,
    ),
  ]);

  return {
    hasActiveRuntimeTopicSnapshot:
      runtimeTopicResult.rows[0]?.has_active_runtime_topic_snapshot === true,
    hasPersistedItems: itemResult.rows[0]?.has_persisted_items === true,
  };
}

export async function upsertWatchlists(
  db: Queryable,
  watchlists: {
    id: string;
    slug: string;
    name: string;
    description: string;
    rules: Record<string, unknown>;
  }[],
) {
  for (const watchlist of watchlists) {
    await db.query(
      `
        INSERT INTO watchlists (id, slug, name, description, rules, active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            rules = EXCLUDED.rules,
            active = TRUE
      `,
      [
        watchlist.id,
        watchlist.slug,
        watchlist.name,
        watchlist.description,
        JSON.stringify(watchlist.rules),
      ],
    );
  }
}

export async function insertSourceStatus(
  db: Queryable,
  sourceStatus: Record<string, PersistedSourceStatus>,
) {
  for (const [source, status] of Object.entries(sourceStatus)) {
    await db.query(
      `
        INSERT INTO source_health (
          source,
          status,
          last_success_at,
          last_error_at,
          last_error_text,
          fallback_used,
          last_latency_ms,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (source) DO UPDATE
        SET status = EXCLUDED.status,
            last_success_at = EXCLUDED.last_success_at,
            last_error_at = EXCLUDED.last_error_at,
            last_error_text = EXCLUDED.last_error_text,
            fallback_used = EXCLUDED.fallback_used,
            last_latency_ms = EXCLUDED.last_latency_ms,
            metadata = EXCLUDED.metadata
      `,
      [
        source,
        status.status,
        status.lastSuccessAt,
        status.lastErrorAt,
        status.lastErrorText,
        status.fallbackUsed,
        status.lastLatencyMs,
        JSON.stringify(status.metadata ?? {}),
      ],
    );
  }
}

async function upsertFeedItems(
  db: Queryable,
  feed: FeedItem[],
  artifactMap: Record<string, CollectionArtifactRef> = {},
) {
  for (const feedItem of feed) {
    const rawMeta: Record<string, unknown> = {
      ...feedItem.rawMeta,
      collectedAt: feedItem.collectedAt,
      timestampOrigin: feedItem.timestampOrigin,
    };

    const itemResult = await db.query(
      `
        INSERT INTO items (
          id,
          canonical_key,
          source,
          source_item_id,
          title,
          summary,
          url,
          author,
          published_at,
          score,
          answer_count,
          comment_count,
          tags,
          content_type,
          is_question,
          raw_meta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (source, source_item_id) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            url = EXCLUDED.url,
            author = EXCLUDED.author,
            published_at = EXCLUDED.published_at,
            score = EXCLUDED.score,
            answer_count = EXCLUDED.answer_count,
            comment_count = EXCLUDED.comment_count,
            tags = EXCLUDED.tags,
            content_type = EXCLUDED.content_type,
            is_question = EXCLUDED.is_question,
            raw_meta = EXCLUDED.raw_meta
        RETURNING id
      `,
      [
        feedItem.id,
        canonicalKey(feedItem),
        feedItem.source,
        feedItem.sourceItemId,
        feedItem.title,
        feedItem.summary,
        feedItem.url,
        feedItem.author ?? null,
        feedItem.publishedAt,
        feedItem.score,
        feedItem.answerCount,
        feedItem.commentCount,
        feedItem.tags,
        feedItem.contentType,
        feedItem.isQuestion,
        JSON.stringify(rawMeta),
      ],
    );
    const persistedItemId =
      typeof itemResult.rows[0]?.id === "string"
        ? itemResult.rows[0].id
        : feedItem.id;

    const commandName =
      typeof rawMeta.commandName === "string"
        ? rawMeta.commandName
        : feedItem.contentType;
    const artifact =
      artifactMap[buildArtifactKey(feedItem.source, commandName)];

    await db.query(
      `
        INSERT INTO item_sources (
          id,
          item_id,
          source,
          source_item_id,
          command,
          source_run_id,
          snapshot_id,
          raw_payload,
          collected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (source, source_item_id) DO UPDATE
        SET command = EXCLUDED.command,
            source_run_id = EXCLUDED.source_run_id,
            snapshot_id = EXCLUDED.snapshot_id,
            raw_payload = EXCLUDED.raw_payload,
            collected_at = EXCLUDED.collected_at
      `,
      [
        randomUUID(),
        persistedItemId,
        feedItem.source,
        feedItem.sourceItemId,
        commandName,
        artifact?.sourceRunId ?? null,
        artifact?.snapshotId ?? null,
        JSON.stringify(rawMeta),
        artifact?.collectedAt ?? feedItem.collectedAt,
      ],
    );

    await db.query("DELETE FROM item_topics WHERE item_id = $1", [
      persistedItemId,
    ]);
    await db.query("DELETE FROM item_entities WHERE item_id = $1", [
      persistedItemId,
    ]);

    for (const topic of feedItem.topics) {
      await db.query(
        `
          INSERT INTO item_topics (item_id, topic_id, confidence, matched_keywords)
          VALUES ($1, $2, $3, $4)
        `,
        [persistedItemId, topic.id, topic.confidence, topic.matchedKeywords],
      );
    }

    for (const entity of feedItem.entities) {
      await db.query(
        `
          INSERT INTO item_entities (
            item_id,
            entity_id,
            confidence,
            matched_keywords,
            repo_name
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          persistedItemId,
          entity.id,
          entity.confidence,
          entity.matchedKeywords,
          entity.repoName ?? null,
        ],
      );
    }
  }
}

export async function replaceSourceItems(
  db: Queryable,
  pipeline: PipelineOutput,
  sources: string[],
  artifactMap: Record<string, CollectionArtifactRef> = {},
) {
  if (sources.length > 0) {
    await db.query("DELETE FROM items WHERE source = ANY($1::text[])", [
      sources,
    ]);
  }

  await upsertFeedItems(db, pipeline.feed, artifactMap);
}

export async function resetDerivedTables(db: Queryable) {
  await db.query("DELETE FROM signal_evidence");
  await db.query("DELETE FROM signals");
  await db.query("DELETE FROM question_cluster_items");
  await db.query("DELETE FROM question_clusters");
}

export async function replaceDerivedPipelineOutput(
  db: Queryable,
  pipeline: PipelineOutput,
  sourceStatus: Record<string, SourceStatus>,
) {
  await resetDerivedTables(db);
  for (const signal of pipeline.signals) {
    const clusterKey = signal.canonicalQuestion
      .toLowerCase()
      .replaceAll(/\s+/g, "-");

    await db.query(
      `
        INSERT INTO question_clusters (
          id,
          cluster_key,
          canonical_question,
          growth_label,
          novelty_label,
          affected_topics,
          affected_entities,
          related_repos,
          source_distribution,
          evidence_count,
          confidence_score,
          freshness_minutes,
          fallback_used,
          recommended_action,
          duplicate_compression_ratio,
          source_diversity_score,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `,
      [
        signal.clusterId,
        clusterKey,
        signal.canonicalQuestion,
        signal.growthLabel,
        signal.noveltyLabel,
        signal.affectedTopics,
        signal.affectedEntities,
        signal.relatedRepos,
        JSON.stringify(signal.sourceDistribution),
        signal.evidenceCount,
        signal.confidenceScore,
        signal.freshnessMinutes,
        signal.fallbackUsed,
        signal.recommendedAction,
        1,
        Object.keys(signal.sourceDistribution).length,
        JSON.stringify({ sourceStatus }),
      ],
    );

    const signalId = randomUUID();
    await db.query(
      `
        INSERT INTO signals (
          id,
          signal_type,
          cluster_id,
          canonical_question,
          pressure_score,
          unresolved_volume,
          growth_label,
          recommended_action,
          confidence_score,
          source_distribution,
          evidence_count,
          freshness_minutes,
          fallback_used,
          payload
        )
        VALUES ($1, 'question_pressure', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        signalId,
        signal.clusterId,
        signal.canonicalQuestion,
        signal.pressureScore,
        signal.unresolvedVolume,
        signal.growthLabel,
        signal.recommendedAction,
        signal.confidenceScore,
        JSON.stringify(signal.sourceDistribution),
        signal.evidenceCount,
        signal.freshnessMinutes,
        signal.fallbackUsed,
        JSON.stringify(signal),
      ],
    );

    const evidence = pipeline.evidenceByClusterId[signal.clusterId] ?? [];
    for (const entry of evidence) {
      await db.query(
        `
          INSERT INTO signal_evidence (
            id,
            signal_id,
            item_id,
            evidence_type,
            source,
            label,
            url,
            payload
          )
          VALUES ($1, $2, $3, 'item', $4, $5, $6, $7)
        `,
        [
          entry.id,
          signalId,
          entry.itemId,
          entry.source,
          entry.label,
          entry.url,
          JSON.stringify(entry),
        ],
      );

      await db.query(
        `
          INSERT INTO question_cluster_items (cluster_id, item_id, similarity)
          VALUES ($1, $2, 1)
          ON CONFLICT (cluster_id, item_id) DO NOTHING
        `,
        [signal.clusterId, entry.itemId],
      );
    }
  }
}

export async function insertPipelineOutput(
  db: Queryable,
  pipeline: PipelineOutput,
  sourceStatus: Record<string, SourceStatus>,
  artifactMap: Record<string, CollectionArtifactRef> = {},
) {
  await upsertFeedItems(db, pipeline.feed, artifactMap);
  await replaceDerivedPipelineOutput(db, pipeline, sourceStatus);
}

export async function getLatestSuccessfulSnapshot(
  db: Queryable,
  source: string,
  commandName: string,
): Promise<FallbackSnapshotRecord | null> {
  const result = await db.query(
    `
      SELECT
        rs.id AS snapshot_id,
        rs.source_run_id,
        rs.collected_at,
        rs.payload
      FROM raw_snapshots rs
      JOIN source_runs sr ON sr.id = rs.source_run_id
      WHERE rs.source = $1
        AND rs.command = $2
        AND sr.status = 'success'
      ORDER BY rs.collected_at DESC
      LIMIT 1
    `,
    [source, commandName],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    sourceRunId: String(row.source_run_id),
    snapshotId: String(row.snapshot_id),
    collectedAt: new Date(String(row.collected_at)).toISOString(),
    payload: Array.isArray(row.payload)
      ? row.payload.map((entry) => entry as Record<string, unknown>)
      : [],
  };
}

export async function listAllNormalizedItems(
  db: Queryable,
): Promise<NormalizedItem[]> {
  const result = await db.query(
    `
      SELECT i.*
      FROM items i
      ORDER BY published_at DESC
    `,
  );

  return result.rows.map((row: unknown) => mapItemRow(row as ItemRow));
}

export async function upsertUnifiedContentRecords(
  db: Queryable,
  records: UnifiedContentRecord[],
) {
  for (const record of records) {
    await db.query(
      `
        INSERT INTO unified_contents (
          canonical_id,
          source,
          source_item_id,
          title,
          summary,
          body_excerpt,
          url,
          author,
          published_at,
          collected_at,
          timestamp_origin,
          tags,
          source_features,
          fingerprint,
          evidence_refs,
          legacy_item_id,
          legacy_item_source_id,
          raw_meta
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        ON CONFLICT (source, source_item_id) DO UPDATE
        SET canonical_id = EXCLUDED.canonical_id,
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            body_excerpt = EXCLUDED.body_excerpt,
            url = EXCLUDED.url,
            author = EXCLUDED.author,
            published_at = EXCLUDED.published_at,
            collected_at = EXCLUDED.collected_at,
            timestamp_origin = EXCLUDED.timestamp_origin,
            tags = EXCLUDED.tags,
            source_features = EXCLUDED.source_features,
            fingerprint = EXCLUDED.fingerprint,
            evidence_refs = EXCLUDED.evidence_refs,
            legacy_item_id = EXCLUDED.legacy_item_id,
            legacy_item_source_id = EXCLUDED.legacy_item_source_id,
            raw_meta = EXCLUDED.raw_meta,
            updated_at = NOW()
      `,
      [
        record.canonicalId,
        record.source,
        record.sourceItemId,
        record.title,
        record.summary,
        record.bodyExcerpt ?? null,
        record.url,
        record.author ?? null,
        record.publishedAt,
        record.collectedAt,
        record.timestampOrigin,
        record.tags,
        JSON.stringify(record.sourceFeatures),
        record.fingerprint,
        record.evidenceRefs,
        record.legacyRefs.itemId,
        record.legacyRefs.itemSourceId,
        JSON.stringify(record.rawMeta),
      ],
    );
  }
}

export async function listUnifiedContentRecords(
  db: Queryable,
  query: { source?: UnifiedContentRecord["source"]; limit?: number } = {},
): Promise<UnifiedContentRecord[]> {
  const result = await db.query(
    `
      SELECT
        canonical_id,
        source,
        source_item_id,
        title,
        summary,
        body_excerpt,
        url,
        author,
        published_at,
        collected_at,
        timestamp_origin,
        tags,
        source_features,
        fingerprint,
        evidence_refs,
        legacy_item_id,
        legacy_item_source_id,
        raw_meta
      FROM unified_contents
      WHERE ($1::text IS NULL OR source = $1)
      ORDER BY collected_at DESC
      LIMIT $2
    `,
    [query.source ?? null, query.limit ?? 20],
  );

  return result.rows.map((row: unknown) =>
    mapUnifiedContentRow(row as UnifiedContentRow),
  );
}

export async function listUnifiedContentRecordsByCanonicalIds(
  db: Queryable,
  canonicalIds: string[],
): Promise<UnifiedContentRecord[]> {
  if (canonicalIds.length === 0) {
    return [];
  }

  const result = await db.query(
    `
      SELECT
        canonical_id,
        source,
        source_item_id,
        title,
        summary,
        body_excerpt,
        url,
        author,
        published_at,
        collected_at,
        timestamp_origin,
        tags,
        source_features,
        fingerprint,
        evidence_refs,
        legacy_item_id,
        legacy_item_source_id,
        raw_meta
      FROM unified_contents
      WHERE canonical_id = ANY($1::text[])
      ORDER BY collected_at DESC
    `,
    [canonicalIds],
  );

  return result.rows.map((row: unknown) =>
    mapUnifiedContentRow(row as UnifiedContentRow),
  );
}

export async function getUnifiedModelCompatibilityReport(
  db: Queryable,
): Promise<UnifiedModelCompatibilityReport> {
  const result = await db.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE i.id IS NULL) AS legacy_item_missing_count,
        COUNT(*) FILTER (
          WHERE uc.legacy_item_source_id IS NOT NULL
            AND s.id IS NULL
        ) AS legacy_item_source_missing_count,
        COUNT(*) FILTER (
          WHERE i.id IS NOT NULL
            AND uc.source <> i.source
        ) AS source_mismatch_count,
        COUNT(*) FILTER (
          WHERE i.id IS NOT NULL
            AND uc.source_item_id <> i.source_item_id
        ) AS source_item_id_mismatch_count
      FROM unified_contents uc
      LEFT JOIN items i ON i.id = uc.legacy_item_id
      LEFT JOIN item_sources s ON s.id = uc.legacy_item_source_id
    `,
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    legacyItemMissingCount: Number(row?.legacy_item_missing_count ?? 0),
    legacyItemSourceMissingCount: Number(
      row?.legacy_item_source_missing_count ?? 0,
    ),
    sourceMismatchCount: Number(row?.source_mismatch_count ?? 0),
    sourceItemIdMismatchCount: Number(row?.source_item_id_mismatch_count ?? 0),
  };
}

export async function rollbackUnifiedContentBySources(
  db: Queryable,
  sources: UnifiedContentRecord["source"][],
): Promise<number> {
  if (sources.length === 0) {
    return 0;
  }

  const result = await db.query(
    `
      DELETE FROM unified_contents
      WHERE source = ANY($1::text[])
      RETURNING canonical_id
    `,
    [sources],
  );

  return result.rows.length;
}

export async function markSupersededEmbeddings(
  db: Queryable,
  query: {
    canonicalId: string;
    source: UnifiedContentRecord["source"];
    model: string;
    inputSchemaVersion: string;
    keepFingerprint?: string;
  },
): Promise<number> {
  const result = await db.query(
    `
      UPDATE embedding_records
      SET status = 'superseded',
          updated_at = NOW()
      WHERE canonical_id = $1
        AND source = $2
        AND model = $3
        AND input_schema_version = $4
        AND status <> 'superseded'
        AND ($5::text IS NULL OR content_fingerprint <> $5)
      RETURNING id
    `,
    [
      query.canonicalId,
      query.source,
      query.model,
      query.inputSchemaVersion,
      query.keepFingerprint ?? null,
    ],
  );

  return result.rows.length;
}

export async function upsertEmbeddingRecord(
  db: Queryable,
  input: UpsertEmbeddingRecordInput,
): Promise<string> {
  const vector = sanitizeEmbeddingVector(input.vector);
  if (vector.length === 0) {
    throw new Error("Embedding vector cannot be empty.");
  }

  await markSupersededEmbeddings(db, {
    canonicalId: input.canonicalId,
    source: input.source,
    model: input.model,
    inputSchemaVersion: input.inputSchemaVersion,
    keepFingerprint: input.contentFingerprint,
  });

  const vectorLiteral = toVectorLiteral(vector);
  const result = await db.query(
    `
      INSERT INTO embedding_records (
        canonical_id,
        source,
        content_fingerprint,
        input_schema_version,
        provider,
        model,
        model_version,
        dimensions,
        embedding_vector,
        status,
        error_text,
        retry_count,
        metadata,
        succeeded_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::vector,
        'succeeded', NULL, 0, $10::jsonb, NOW()
      )
      ON CONFLICT (source, content_fingerprint, model, input_schema_version)
      WHERE status <> 'superseded'
      DO UPDATE
      SET canonical_id = EXCLUDED.canonical_id,
          provider = EXCLUDED.provider,
          model_version = EXCLUDED.model_version,
          dimensions = EXCLUDED.dimensions,
          embedding_vector = EXCLUDED.embedding_vector,
          status = 'succeeded',
          error_text = NULL,
          retry_count = 0,
          metadata = EXCLUDED.metadata,
          succeeded_at = NOW(),
          updated_at = NOW()
      RETURNING id
    `,
    [
      input.canonicalId,
      input.source,
      input.contentFingerprint,
      input.inputSchemaVersion,
      input.provider,
      input.model,
      input.modelVersion,
      vector.length,
      vectorLiteral,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const id = result.rows[0]?.id;
  if (typeof id !== "string") {
    throw new Error("Failed to upsert embedding record.");
  }
  return id;
}

export async function listEmbeddingRecords(
  db: Queryable,
  query: ListEmbeddingRecordsQuery = {},
): Promise<EmbeddingRecordPersisted[]> {
  const result = await db.query(
    `
      SELECT
        id,
        canonical_id,
        source,
        content_fingerprint,
        input_schema_version,
        provider,
        model,
        model_version,
        dimensions,
        embedding_vector::text AS embedding_vector_text,
        status,
        error_text,
        retry_count,
        metadata,
        created_at,
        updated_at,
        succeeded_at
      FROM embedding_records
      WHERE ($1::text IS NULL OR canonical_id = $1)
        AND ($2::text IS NULL OR source = $2)
        AND ($3::text IS NULL OR model = $3)
        AND ($4::text IS NULL OR status = $4)
      ORDER BY updated_at DESC, created_at DESC
      LIMIT $5
    `,
    [
      query.canonicalId ?? null,
      query.source ?? null,
      query.model ?? null,
      query.status ?? null,
      query.limit ?? 50,
    ],
  );

  return result.rows.map((row: unknown) =>
    mapEmbeddingRow(row as EmbeddingRow),
  );
}

export async function listEmbeddingBackfillCandidates(
  db: Queryable,
  query: ListEmbeddingBackfillQuery,
): Promise<EmbeddingBackfillCandidate[]> {
  const statusFilter = query.includeFailed ? ["failed"] : [];
  const result = await db.query(
    `
      SELECT
        uc.canonical_id,
        uc.source,
        uc.fingerprint,
        uc.collected_at
      FROM unified_contents uc
      LEFT JOIN embedding_records er
        ON er.source = uc.source
       AND er.content_fingerprint = uc.fingerprint
       AND er.model = $2
       AND er.input_schema_version = $3
       AND er.status <> 'superseded'
      WHERE ($1::text IS NULL OR uc.source = $1)
        AND (
          er.id IS NULL
          OR (
            COALESCE(array_length($4::text[], 1), 0) > 0
            AND er.status = ANY($4::text[])
          )
        )
      ORDER BY uc.collected_at DESC
      LIMIT $5
    `,
    [
      query.source ?? null,
      query.model,
      query.inputSchemaVersion,
      statusFilter,
      query.limit ?? 100,
    ],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    canonicalId: String(row.canonical_id),
    source: String(row.source) as UnifiedContentRecord["source"],
    contentFingerprint: String(row.fingerprint),
    collectedAt: new Date(String(row.collected_at)).toISOString(),
  }));
}

export async function updateEmbeddingRecordStatus(
  db: Queryable,
  input: UpdateEmbeddingStatusInput,
): Promise<boolean> {
  const result = await db.query(
    `
      UPDATE embedding_records
      SET status = $2,
          error_text = CASE
            WHEN $2 = 'failed' THEN $3
            ELSE NULL
          END,
          retry_count = $4,
          succeeded_at = CASE
            WHEN $2 = 'succeeded' THEN NOW()
            ELSE succeeded_at
          END,
          updated_at = NOW()
      WHERE id = $1
        AND status <> 'superseded'
      RETURNING id
    `,
    [input.id, input.status, input.errorText ?? null, input.retryCount ?? 0],
  );

  return result.rows.length > 0;
}

export async function upsertTopicCluster(
  db: Queryable,
  input: UpsertTopicClusterInput,
): Promise<TopicClusterPersisted> {
  const result = await db.query(
    `
      INSERT INTO topic_clusters (
        topic_cluster_id,
        stable_key,
        cluster_version,
        rule_version,
        status,
        slug,
        display_name,
        summary,
        keywords,
        anchor_canonical_id,
        representative_evidence,
        source_mix,
        related_repos,
        related_entities,
        item_count,
        cluster_confidence,
        runtime_fallback_reason,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17, $18::jsonb
      )
      ON CONFLICT (topic_cluster_id, cluster_version) DO UPDATE
      SET stable_key = EXCLUDED.stable_key,
          rule_version = EXCLUDED.rule_version,
          status = EXCLUDED.status,
          slug = EXCLUDED.slug,
          display_name = EXCLUDED.display_name,
          summary = EXCLUDED.summary,
          keywords = EXCLUDED.keywords,
          anchor_canonical_id = EXCLUDED.anchor_canonical_id,
          representative_evidence = EXCLUDED.representative_evidence,
          source_mix = EXCLUDED.source_mix,
          related_repos = EXCLUDED.related_repos,
          related_entities = EXCLUDED.related_entities,
          item_count = EXCLUDED.item_count,
          cluster_confidence = EXCLUDED.cluster_confidence,
          runtime_fallback_reason = EXCLUDED.runtime_fallback_reason,
          metadata = EXCLUDED.metadata,
          updated_at = NOW(),
          superseded_at = CASE
            WHEN EXCLUDED.status = 'superseded' THEN NOW()
            ELSE NULL
          END
      RETURNING
        id,
        topic_cluster_id,
        stable_key,
        cluster_version,
        rule_version,
        status,
        slug,
        display_name,
        summary,
        keywords,
        anchor_canonical_id,
        representative_evidence,
        source_mix,
        related_repos,
        related_entities,
        item_count,
        cluster_confidence,
        runtime_fallback_reason,
        metadata,
        created_at,
        updated_at
    `,
    [
      input.topicClusterId,
      input.stableKey,
      input.clusterVersion,
      input.ruleVersion,
      input.status,
      input.slug,
      input.displayName,
      input.summary,
      input.keywords,
      input.anchorCanonicalId,
      JSON.stringify(input.representativeEvidence),
      JSON.stringify(input.sourceMix),
      input.relatedRepos,
      input.relatedEntities,
      input.itemCount,
      input.clusterConfidence,
      input.runtimeFallbackReason ?? null,
      JSON.stringify(input.metadata),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to upsert topic cluster.");
  }
  return mapTopicClusterRow(row as TopicClusterRow);
}

export async function replaceTopicClusterMemberships(
  db: Queryable,
  input: ReplaceTopicClusterMembershipsInput,
): Promise<number> {
  await db.query(
    `
      DELETE FROM topic_cluster_memberships
      WHERE topic_cluster_row_id = $1
    `,
    [input.topicClusterRowId],
  );

  for (const membership of input.memberships) {
    await db.query(
      `
        INSERT INTO topic_cluster_memberships (
          topic_cluster_row_id,
          topic_cluster_id,
          cluster_version,
          canonical_id,
          item_id,
          embedding_record_id,
          source,
          membership_confidence,
          primary_evidence,
          evidence_rank,
          reasoning_tags,
          metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
        )
      `,
      [
        input.topicClusterRowId,
        membership.topicClusterId,
        membership.clusterVersion,
        membership.canonicalId,
        membership.itemId,
        membership.embeddingRecordId ?? null,
        membership.source,
        membership.membershipConfidence,
        membership.primaryEvidence,
        membership.evidenceRank,
        membership.reasoningTags,
        JSON.stringify(membership.metadata),
      ],
    );
  }

  return input.memberships.length;
}

export async function markSupersededTopicClusters(
  db: Queryable,
  query: {
    ruleVersion: string;
    batchTopicClusterIds: string[];
    keepRowIds: string[];
  },
): Promise<number> {
  const result = await db.query(
    `
      UPDATE topic_clusters
      SET status = 'superseded',
          superseded_at = NOW(),
          updated_at = NOW()
      WHERE rule_version = $1
        AND status = 'active'
        AND topic_cluster_id = ANY($2::uuid[])
        AND id <> ALL($3::uuid[])
      RETURNING id
    `,
    [query.ruleVersion, query.batchTopicClusterIds, query.keepRowIds],
  );

  return result.rows.length;
}

export async function listActiveTopicClusters(
  db: Queryable,
  query: {
    limit?: number;
  } = {},
): Promise<TopicClusterPersisted[]> {
  const result = await db.query(
    `
      SELECT
        id,
        topic_cluster_id,
        stable_key,
        cluster_version,
        rule_version,
        status,
        slug,
        display_name,
        summary,
        keywords,
        anchor_canonical_id,
        representative_evidence,
        source_mix,
        related_repos,
        related_entities,
        item_count,
        cluster_confidence,
        runtime_fallback_reason,
        metadata,
        created_at,
        updated_at
      FROM topic_clusters
      WHERE status = 'active'
      ORDER BY cluster_confidence DESC, updated_at DESC, topic_cluster_id ASC
      LIMIT $1
    `,
    [query.limit ?? 100],
  );

  return result.rows.map((row: unknown) =>
    mapTopicClusterRow(row as TopicClusterRow),
  );
}

export async function listTopicClusterMemberships(
  db: Queryable,
  topicClusterId: string,
): Promise<TopicClusterMembership[]> {
  const result = await db.query(
    `
      SELECT
        m.topic_cluster_id,
        m.cluster_version,
        m.canonical_id,
        m.item_id,
        m.embedding_record_id,
        m.source,
        m.membership_confidence,
        m.primary_evidence,
        m.evidence_rank,
        m.reasoning_tags,
        m.metadata
      FROM topic_cluster_memberships m
      JOIN topic_clusters tc ON tc.id = m.topic_cluster_row_id
      WHERE tc.status = 'active'
        AND m.topic_cluster_id = $1
      ORDER BY m.evidence_rank ASC, m.created_at ASC
    `,
    [topicClusterId],
  );

  return result.rows.map((row: unknown) =>
    mapTopicClusterMembershipRow(row as TopicClusterMembershipRow),
  );
}

export async function upsertTopicLabelCandidate(
  db: Queryable,
  input: UpsertTopicLabelCandidateInput,
): Promise<TopicLabelCandidate> {
  const result = await db.query(
    `
      INSERT INTO topic_label_candidates (
        topic_cluster_id,
        cluster_version,
        status,
        label,
        summary,
        keywords,
        taxonomy_l1,
        taxonomy_l2,
        taxonomy_l3,
        fallback_reason,
        provider,
        model,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13::jsonb
      )
      ON CONFLICT (topic_cluster_id, cluster_version) DO UPDATE
      SET status = EXCLUDED.status,
          label = EXCLUDED.label,
          summary = EXCLUDED.summary,
          keywords = EXCLUDED.keywords,
          taxonomy_l1 = EXCLUDED.taxonomy_l1,
          taxonomy_l2 = EXCLUDED.taxonomy_l2,
          taxonomy_l3 = EXCLUDED.taxonomy_l3,
          fallback_reason = EXCLUDED.fallback_reason,
          provider = EXCLUDED.provider,
          model = EXCLUDED.model,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      RETURNING
        id,
        topic_cluster_id,
        cluster_version,
        status,
        label,
        summary,
        keywords,
        taxonomy_l1,
        taxonomy_l2,
        taxonomy_l3,
        fallback_reason,
        provider,
        model,
        metadata,
        created_at,
        updated_at
    `,
    [
      input.topicClusterId,
      input.clusterVersion,
      input.status,
      input.label,
      input.summary,
      input.keywords,
      input.taxonomyL1,
      input.taxonomyL2 ?? null,
      input.taxonomyL3 ?? null,
      input.fallbackReason ?? null,
      input.provider ?? null,
      input.model ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to upsert topic label candidate.");
  }
  return mapTopicLabelCandidateRow(row as TopicLabelCandidateRow);
}

export async function upsertTopicNode(
  db: Queryable,
  input: UpsertTopicNodeInput,
): Promise<TopicNode> {
  const result = await db.query(
    `
      INSERT INTO topic_nodes (
        slug,
        display_name,
        level,
        parent_topic_id,
        source,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (slug) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          level = EXCLUDED.level,
          parent_topic_id = EXCLUDED.parent_topic_id,
          source = EXCLUDED.source,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      RETURNING
        id,
        slug,
        display_name,
        level,
        parent_topic_id,
        source,
        metadata,
        created_at,
        updated_at
    `,
    [
      input.slug,
      input.displayName,
      input.level,
      input.parentTopicId ?? null,
      input.source,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to upsert topic node.");
  }
  return mapTopicNodeRow(row as TopicNodeRow);
}

export async function upsertTopicLineage(
  db: Queryable,
  input: UpsertTopicLineageInput,
): Promise<TopicLineage> {
  const result = await db.query(
    `
      INSERT INTO topic_lineage (
        topic_cluster_id,
        cluster_version,
        label_candidate_id,
        l1_topic_id,
        l2_topic_id,
        l3_topic_id,
        path_slugs,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (topic_cluster_id, cluster_version) DO UPDATE
      SET label_candidate_id = EXCLUDED.label_candidate_id,
          l1_topic_id = EXCLUDED.l1_topic_id,
          l2_topic_id = EXCLUDED.l2_topic_id,
          l3_topic_id = EXCLUDED.l3_topic_id,
          path_slugs = EXCLUDED.path_slugs,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      RETURNING
        id,
        topic_cluster_id,
        cluster_version,
        label_candidate_id,
        l1_topic_id,
        l2_topic_id,
        l3_topic_id,
        path_slugs,
        metadata,
        created_at,
        updated_at
    `,
    [
      input.topicClusterId,
      input.clusterVersion,
      input.labelCandidateId,
      input.l1TopicId,
      input.l2TopicId ?? null,
      input.l3TopicId ?? null,
      input.pathSlugs,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to upsert topic lineage.");
  }
  return mapTopicLineageRow(row as TopicLineageRow);
}

export async function replaceTopicMemberships(
  db: Queryable,
  input: ReplaceTopicMembershipsInput,
): Promise<number> {
  await db.query(
    `
      DELETE FROM topic_memberships
      WHERE topic_cluster_id = $1
        AND cluster_version = $2
    `,
    [input.topicClusterId, input.clusterVersion],
  );

  for (const membership of input.memberships) {
    await db.query(
      `
        INSERT INTO topic_memberships (
          topic_cluster_id,
          cluster_version,
          topic_node_id,
          membership_role,
          confidence,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        membership.topicClusterId,
        membership.clusterVersion,
        membership.topicId,
        membership.membershipRole,
        membership.confidence,
        JSON.stringify(membership.metadata ?? {}),
      ],
    );
  }

  return input.memberships.length;
}

export async function listTopicMemberships(
  db: Queryable,
  topicClusterId: string,
  clusterVersion: string,
): Promise<TopicMembership[]> {
  const result = await db.query(
    `
      SELECT
        topic_cluster_id,
        cluster_version,
        topic_node_id,
        membership_role,
        confidence,
        metadata
      FROM topic_memberships
      WHERE topic_cluster_id = $1
        AND cluster_version = $2
      ORDER BY confidence DESC, membership_role ASC
    `,
    [topicClusterId, clusterVersion],
  );

  return result.rows.map((row: unknown) =>
    mapTopicMembershipRow(row as TopicMembershipRow),
  );
}

export async function listRuntimeTopicClusterSeeds(
  db: Queryable,
  limit = 24,
): Promise<RuntimeTopicSeed[]> {
  const clusters = await listActiveTopicClusters(db, { limit });
  return clusters
    .filter(
      (cluster) =>
        cluster.runtimeFallbackReason === undefined &&
        cluster.keywords.length > 0,
    )
    .map((cluster) => ({
      runId: cluster.topicClusterId,
      slug: cluster.slug,
      name: cluster.displayName,
      keywords: cluster.keywords,
      sourcePriority: Math.max(1, Math.round(cluster.clusterConfidence * 100)),
      sources: ["topic-cluster"],
      devtoTags: cluster.keywords.slice(0, 3),
      score: Number((cluster.clusterConfidence * 100).toFixed(2)),
      active: true,
      refreshedAt: cluster.updatedAt,
      expiresAt: new Date(
        new Date(cluster.updatedAt).getTime() + 2 * 60 * 60 * 1000,
      ).toISOString(),
      metadata: {
        topicClusterId: cluster.topicClusterId,
        clusterVersion: cluster.clusterVersion,
        runtimeFallbackReason: cluster.runtimeFallbackReason ?? null,
        relatedRepos: cluster.relatedRepos,
        relatedEntities: cluster.relatedEntities,
      },
    }));
}

export async function listFeed(
  db: Queryable,
  query: FeedQuery,
): Promise<FeedItem[]> {
  const result = await db.query(
    `
      SELECT i.*
      FROM items i
      WHERE ($1::text IS NULL OR i.source = $1)
        AND (
          $2::text IS NULL
          OR EXISTS (
            SELECT 1
            FROM item_topics it
            JOIN topics t ON t.id = it.topic_id
            WHERE it.item_id = i.id
              AND t.slug = $2
          )
        )
        AND (
          $3::text IS NULL
          OR EXISTS (
            SELECT 1
            FROM item_entities ie
            JOIN entities e ON e.id = ie.entity_id
            WHERE ie.item_id = i.id
              AND e.slug = $3
          )
        )
      ORDER BY published_at DESC
      LIMIT $4
    `,
    [
      query.source ?? null,
      query.topic ?? null,
      query.entity ?? null,
      query.limit ?? 20,
    ],
  );

  const items = result.rows.map((row: unknown) => mapItemRow(row as ItemRow));
  const feed: FeedItem[] = [];

  for (const item of items) {
    const topics = await getItemTopics(db, item.id);
    const entities = await getItemEntities(db, item.id);

    if (query.topic && !topics.some((topic) => topic.slug === query.topic)) {
      continue;
    }

    if (
      query.entity &&
      !entities.some((entity) => entity.slug === query.entity)
    ) {
      continue;
    }

    feed.push({
      ...item,
      topics,
      entities,
    });
  }

  return feed.slice(0, query.limit ?? 20);
}

export async function listQuestionPressureSignals(
  db: Queryable,
  query: QuestionPressureQuery,
): Promise<QuestionPressureSignal[]> {
  const result = await db.query(
    `
      SELECT s.payload
      FROM signals s
      JOIN question_clusters qc ON qc.id = s.cluster_id
      WHERE s.signal_type = 'question_pressure'
        AND ($1::text IS NULL OR $1 = ANY(qc.affected_topics))
        AND ($2::text IS NULL OR $2 = ANY(qc.affected_entities))
      ORDER BY s.pressure_score DESC, s.updated_at DESC
      LIMIT $3
    `,
    [query.topic ?? null, query.entity ?? null, query.limit ?? 20],
  );

  return result.rows.map(
    (row: Record<string, unknown>) => row.payload as QuestionPressureSignal,
  );
}

export async function getQuestionCluster(
  db: Queryable,
  clusterId: string,
): Promise<QuestionCluster | null> {
  const result = await db.query(
    `
      SELECT
        id,
        canonical_question,
        growth_label,
        novelty_label,
        affected_topics,
        affected_entities,
        related_repos,
        source_distribution,
        evidence_count,
        confidence_score,
        freshness_minutes,
        fallback_used,
        recommended_action
      FROM question_clusters
      WHERE id = $1
    `,
    [clusterId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    clusterId: row.id,
    canonicalQuestion: row.canonical_question,
    growthLabel: row.growth_label,
    noveltyLabel: row.novelty_label,
    affectedTopics: row.affected_topics ?? [],
    affectedEntities: row.affected_entities ?? [],
    relatedRepos: row.related_repos ?? [],
    sourceDistribution: row.source_distribution ?? {},
    evidenceCount: row.evidence_count,
    confidenceScore: Number(row.confidence_score),
    freshnessMinutes: row.freshness_minutes,
    fallbackUsed: row.fallback_used,
    recommendedAction: row.recommended_action,
  };
}

export async function getQuestionEvidence(
  db: Queryable,
  clusterId: string,
  limit = 20,
): Promise<QuestionEvidence[]> {
  const result = await db.query(
    `
      SELECT se.payload
      FROM signal_evidence se
      JOIN signals s ON s.id = se.signal_id
      WHERE s.cluster_id = $1
      ORDER BY se.created_at DESC
      LIMIT $2
    `,
    [clusterId, limit],
  );

  return result.rows.map(
    (row: Record<string, unknown>) => row.payload as QuestionEvidence,
  );
}

export async function getSourceStatusMap(
  db: Queryable,
): Promise<Record<string, SourceStatus>> {
  const result = await db.query(
    `
      SELECT
        source,
        status,
        last_success_at,
        last_error_at,
        last_error_text,
        fallback_used,
        last_latency_ms
      FROM source_health
    `,
  );

  return result.rows.reduce<Record<string, SourceStatus>>(
    (accumulator, row: Record<string, unknown>) => {
      accumulator[String(row.source)] = {
        status: row.status as SourceStatus["status"],
        lastSuccessAt: row.last_success_at
          ? new Date(String(row.last_success_at)).toISOString()
          : null,
        lastErrorAt: row.last_error_at
          ? new Date(String(row.last_error_at)).toISOString()
          : null,
        lastErrorText:
          typeof row.last_error_text === "string" ? row.last_error_text : null,
        fallbackUsed: row.fallback_used === true,
        lastLatencyMs: Number(row.last_latency_ms ?? 0),
      };
      return accumulator;
    },
    {},
  );
}
