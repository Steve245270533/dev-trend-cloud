import { randomUUID } from "node:crypto";
import type {
  FeedItem,
  FeedQuery,
  MatchedEntity,
  MatchedTopic,
  NormalizedItem,
  QuestionCluster,
  QuestionEvidence,
  QuestionPressureQuery,
  QuestionPressureSignal,
  SourceStatus,
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

type PersistedSourceStatus = SourceStatus & {
  metadata?: Record<string, unknown>;
};

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

export async function pingDatabase(db: Queryable): Promise<boolean> {
  await db.query("SELECT 1");
  return true;
}

export async function resetRuntimeTables(db: Queryable) {
  await db.query(
    `
      TRUNCATE TABLE
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

    await db.query(
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
        feedItem.id,
        feedItem.source,
        feedItem.sourceItemId,
        commandName,
        artifact?.sourceRunId ?? null,
        artifact?.snapshotId ?? null,
        JSON.stringify(rawMeta),
        artifact?.collectedAt ?? feedItem.collectedAt,
      ],
    );

    await db.query("DELETE FROM item_topics WHERE item_id = $1", [feedItem.id]);
    await db.query("DELETE FROM item_entities WHERE item_id = $1", [
      feedItem.id,
    ]);

    for (const topic of feedItem.topics) {
      await db.query(
        `
          INSERT INTO item_topics (item_id, topic_id, confidence, matched_keywords)
          VALUES ($1, $2, $3, $4)
        `,
        [feedItem.id, topic.id, topic.confidence, topic.matchedKeywords],
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
          feedItem.id,
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
