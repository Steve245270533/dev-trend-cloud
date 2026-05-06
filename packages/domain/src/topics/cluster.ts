import { createHash } from "node:crypto";
import type {
  RuntimeTopicFallbackReason,
  RuntimeTopicSeed,
  SourceKey,
  TopicCluster,
  TopicClusterMembership,
  TopicClusterRepresentativeEvidence,
  TopicClusterSourceMix,
  UnifiedContentRecord,
} from "@devtrend/contracts";

const TOPIC_CLUSTER_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
const MIN_VECTOR_SIMILARITY = 0.82;
const HIGH_VECTOR_SIMILARITY = 0.9;
const MAX_RUNTIME_TOPIC_SEEDS = 24;
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "using",
  "what",
  "why",
  "with",
]);

export const TOPIC_CLUSTER_RULE_VERSION = "topic-cluster-rules-v1";

export interface TopicClusterCandidateInput {
  embeddingId: string;
  vector: number[];
  content: UnifiedContentRecord;
}

export interface TopicClusterResult {
  cluster: TopicCluster;
  memberships: TopicClusterMembership[];
}

interface PairDecision {
  confidence: number;
  reasoningTags: string[];
}

interface ClusterCandidate {
  items: TopicClusterCandidateInput[];
}

interface ClusterSignals {
  keywords: string[];
  relatedRepos: string[];
  relatedEntities: string[];
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeText).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function splitWords(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function normalizeToken(value: string): string {
  return value.length > 4 && value.endsWith("s") ? value.slice(0, -1) : value;
}

function normalizedTokenSet(content: UnifiedContentRecord): Set<string> {
  return new Set(
    [content.title, content.summary, content.bodyExcerpt ?? ""]
      .flatMap(splitWords)
      .map(normalizeToken)
      .filter(Boolean),
  );
}

function stringArrayFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function extractRepos(content: UnifiedContentRecord): string[] {
  const rawMeta = content.rawMeta;
  const repoCandidates = [
    ...stringArrayFromUnknown(rawMeta.repo),
    ...stringArrayFromUnknown(rawMeta.repoName),
    ...stringArrayFromUnknown(rawMeta.repoFullName),
    ...stringArrayFromUnknown(rawMeta.repos),
    ...stringArrayFromUnknown(rawMeta.repoNames),
    ...stringArrayFromUnknown(rawMeta.repositories),
  ];
  return uniqueSorted(repoCandidates.map((repo) => normalizeText(repo)));
}

function extractEntities(content: UnifiedContentRecord): string[] {
  const rawMeta = content.rawMeta;
  const entityCandidates = [
    ...stringArrayFromUnknown(rawMeta.entity),
    ...stringArrayFromUnknown(rawMeta.entityName),
    ...stringArrayFromUnknown(rawMeta.entitySlug),
    ...stringArrayFromUnknown(rawMeta.entities),
    ...stringArrayFromUnknown(rawMeta.entityNames),
    ...stringArrayFromUnknown(rawMeta.entitySlugs),
    ...stringArrayFromUnknown(rawMeta.collectionMembership),
  ];
  return uniqueSorted(entityCandidates.map((entry) => normalizeText(entry)));
}

function setOverlapCount(
  left: Iterable<string>,
  right: Iterable<string>,
): number {
  const rightSet = new Set(right);
  let count = 0;
  for (const value of left) {
    if (rightSet.has(value)) {
      count += 1;
    }
  }
  return count;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function publishedAtMillis(content: UnifiedContentRecord): number {
  return new Date(content.publishedAt).getTime();
}

function isExactDuplicate(
  left: TopicClusterCandidateInput,
  right: TopicClusterCandidateInput,
): boolean {
  return (
    left.content.url === right.content.url ||
    left.content.fingerprint === right.content.fingerprint
  );
}

function evaluatePair(
  left: TopicClusterCandidateInput,
  right: TopicClusterCandidateInput,
): PairDecision | null {
  const publishedDistance = Math.abs(
    publishedAtMillis(left.content) - publishedAtMillis(right.content),
  );
  if (publishedDistance > TOPIC_CLUSTER_WINDOW_MS) {
    return null;
  }

  const leftTags = normalizeTags(left.content.tags);
  const rightTags = normalizeTags(right.content.tags);
  const leftRepos = extractRepos(left.content);
  const rightRepos = extractRepos(right.content);
  const leftEntities = extractEntities(left.content);
  const rightEntities = extractEntities(right.content);
  const tokenOverlap = setOverlapCount(
    normalizedTokenSet(left.content),
    normalizedTokenSet(right.content),
  );
  const sharedTags = setOverlapCount(leftTags, rightTags);
  const sharedRepos = setOverlapCount(leftRepos, rightRepos);
  const sharedEntities = setOverlapCount(leftEntities, rightEntities);
  const vectorSimilarity = cosineSimilarity(left.vector, right.vector);
  const exactDuplicate = isExactDuplicate(left, right);
  const hasRepoConflict =
    leftRepos.length > 0 && rightRepos.length > 0 && sharedRepos === 0;
  const hasEntityConflict =
    leftEntities.length > 0 && rightEntities.length > 0 && sharedEntities === 0;

  if (hasRepoConflict && vectorSimilarity < 0.97) {
    return null;
  }

  if (hasEntityConflict && vectorSimilarity < 0.97) {
    return null;
  }

  if (!exactDuplicate && vectorSimilarity < MIN_VECTOR_SIMILARITY) {
    return null;
  }

  const hasStrongAnchor =
    sharedRepos > 0 ||
    sharedEntities > 0 ||
    (sharedTags >= 2 && tokenOverlap >= 2) ||
    tokenOverlap >= 4;
  const hasHighSimilarityMerge =
    vectorSimilarity >= HIGH_VECTOR_SIMILARITY &&
    (sharedTags > 0 ||
      sharedRepos > 0 ||
      sharedEntities > 0 ||
      tokenOverlap >= 2);

  if (!exactDuplicate && !hasStrongAnchor && !hasHighSimilarityMerge) {
    return null;
  }

  const confidence = Math.min(
    1,
    Number(
      (
        vectorSimilarity * 0.62 +
        Math.min(sharedRepos, 1) * 0.15 +
        Math.min(sharedEntities, 1) * 0.12 +
        Math.min(sharedTags, 2) * 0.04 +
        Math.min(tokenOverlap, 4) * 0.02 +
        (exactDuplicate ? 0.15 : 0)
      ).toFixed(4),
    ),
  );
  const reasoningTags = uniqueSorted(
    [
      exactDuplicate ? "dedupe" : "",
      sharedRepos > 0 ? "shared-repo" : "",
      sharedEntities > 0 ? "shared-entity" : "",
      sharedTags > 0 ? "shared-tag" : "",
      tokenOverlap >= 2 ? "token-overlap" : "",
      vectorSimilarity >= HIGH_VECTOR_SIMILARITY
        ? "high-embedding-similarity"
        : "",
    ].filter(Boolean),
  );

  return {
    confidence,
    reasoningTags,
  };
}

function sortInputs(
  inputs: TopicClusterCandidateInput[],
): TopicClusterCandidateInput[] {
  return [...inputs].sort((left, right) => {
    const leftKey = [
      left.content.publishedAt,
      left.content.source,
      left.content.canonicalId,
    ].join("|");
    const rightKey = [
      right.content.publishedAt,
      right.content.source,
      right.content.canonicalId,
    ].join("|");
    return leftKey.localeCompare(rightKey);
  });
}

function stableUuid(key: string): string {
  const hex = createHash("sha1").update(key).digest("hex");
  const chars = hex.slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8).toString(
    16,
  );
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

function aggregateSignals(items: TopicClusterCandidateInput[]): ClusterSignals {
  const tokenCounts = new Map<string, number>();
  const repoCounts = new Map<string, number>();
  const entityCounts = new Map<string, number>();

  for (const item of items) {
    for (const tag of normalizeTags(item.content.tags)) {
      tokenCounts.set(tag, (tokenCounts.get(tag) ?? 0) + 3);
    }
    for (const token of normalizedTokenSet(item.content)) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
    for (const repo of extractRepos(item.content)) {
      repoCounts.set(repo, (repoCounts.get(repo) ?? 0) + 1);
      tokenCounts.set(repo, (tokenCounts.get(repo) ?? 0) + 2);
    }
    for (const entity of extractEntities(item.content)) {
      entityCounts.set(entity, (entityCounts.get(entity) ?? 0) + 1);
      tokenCounts.set(entity, (tokenCounts.get(entity) ?? 0) + 2);
    }
  }

  const keywords = [...tokenCounts.entries()]
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return left[0].localeCompare(right[0]);
      }
      return right[1] - left[1];
    })
    .map(([token]) => token)
    .filter((token) => token.length >= 3)
    .slice(0, 6);

  return {
    keywords,
    relatedRepos: [...repoCounts.keys()].sort((left, right) =>
      left.localeCompare(right),
    ),
    relatedEntities: [...entityCounts.keys()].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function sourceMix(
  items: TopicClusterCandidateInput[],
): TopicClusterSourceMix[] {
  const counts = items.reduce<Record<SourceKey, number>>(
    (accumulator, item) => {
      accumulator[item.content.source] += 1;
      return accumulator;
    },
    {
      stackoverflow: 0,
      hackernews: 0,
      devto: 0,
      ossinsight: 0,
    },
  );
  const total = items.length || 1;
  return (Object.entries(counts) as [SourceKey, number][])
    .filter(([, count]) => count > 0)
    .map(([source, count]) => ({
      source,
      count,
      ratio: Number((count / total).toFixed(4)),
    }))
    .sort((left, right) => {
      if (right.count === left.count) {
        return left.source.localeCompare(right.source);
      }
      return right.count - left.count;
    });
}

function evidenceScore(item: TopicClusterCandidateInput): number {
  const content = item.content;
  return (
    normalizeText(content.title).length +
    normalizeText(content.summary).length * 0.4 +
    content.tags.length * 10 +
    extractRepos(content).length * 18 +
    extractEntities(content).length * 12
  );
}

function pickAnchor(
  items: TopicClusterCandidateInput[],
): TopicClusterCandidateInput {
  return [...items].sort((left, right) => {
    const scoreDiff = evidenceScore(right) - evidenceScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.content.canonicalId.localeCompare(right.content.canonicalId);
  })[0];
}

function buildSlug(
  signals: ClusterSignals,
  anchor: TopicClusterCandidateInput,
): string {
  const parts =
    signals.keywords.length > 0
      ? signals.keywords
      : splitWords(anchor.content.title);
  const slug = parts
    .slice(0, 4)
    .map((part) => normalizeToken(part))
    .filter(Boolean)
    .join("-");
  return slug.length > 0
    ? slug
    : normalizeText(anchor.content.sourceItemId).replace(/\s+/g, "-");
}

function toDisplayName(
  slug: string,
  anchor: TopicClusterCandidateInput,
): string {
  const fromSlug = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  return fromSlug.length > 0 ? fromSlug : anchor.content.title;
}

function buildSummary(
  anchor: TopicClusterCandidateInput,
  signals: ClusterSignals,
  count: number,
): string {
  const keywordPart =
    signals.keywords.length > 0
      ? `keywords: ${signals.keywords.slice(0, 3).join(", ")}`
      : "";
  const repoPart =
    signals.relatedRepos.length > 0
      ? `repos: ${signals.relatedRepos.slice(0, 2).join(", ")}`
      : "";
  return [anchor.content.title, keywordPart, repoPart, `${count} items`]
    .filter(Boolean)
    .join(" | ");
}

function buildStableKey(
  anchor: TopicClusterCandidateInput,
  signals: ClusterSignals,
): string {
  const signature = [
    anchor.content.canonicalId,
    signals.relatedRepos.join(","),
    signals.relatedEntities.join(","),
    signals.keywords.slice(0, 4).join(","),
  ].join("|");
  return `topic-cluster:${createHash("sha1").update(signature).digest("hex")}`;
}

function buildClusterVersion(
  items: TopicClusterCandidateInput[],
  anchorCanonicalId: string,
): string {
  const payload = sortInputs(items)
    .map((item) => `${item.content.canonicalId}:${item.content.fingerprint}`)
    .join("|");
  return createHash("sha1")
    .update(`${TOPIC_CLUSTER_RULE_VERSION}|${anchorCanonicalId}|${payload}`)
    .digest("hex");
}

function membershipConfidence(
  item: TopicClusterCandidateInput,
  anchor: TopicClusterCandidateInput,
): PairDecision {
  if (item.content.canonicalId === anchor.content.canonicalId) {
    return {
      confidence: 1,
      reasoningTags: ["cluster-anchor", "primary-evidence"],
    };
  }

  return (
    evaluatePair(item, anchor) ?? {
      confidence: 0.74,
      reasoningTags: ["cluster-neighbor"],
    }
  );
}

function buildRepresentativeEvidence(
  items: TopicClusterCandidateInput[],
  anchor: TopicClusterCandidateInput,
): TopicClusterRepresentativeEvidence[] {
  const sorted = [...items].sort((left, right) => {
    const scoreDiff = evidenceScore(right) - evidenceScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.content.canonicalId.localeCompare(right.content.canonicalId);
  });
  const selected: TopicClusterRepresentativeEvidence[] = [];
  const coveredSources = new Set<SourceKey>();

  for (const item of [anchor, ...sorted.filter((entry) => entry !== anchor)]) {
    const confidence = membershipConfidence(item, anchor).confidence;
    const role =
      item.content.canonicalId === anchor.content.canonicalId
        ? "primary"
        : "supporting";
    if (
      role === "supporting" &&
      coveredSources.has(item.content.source) &&
      selected.length >= 3
    ) {
      continue;
    }

    selected.push({
      canonicalId: item.content.canonicalId,
      itemId: item.content.legacyRefs.itemId,
      source: item.content.source,
      title: item.content.title,
      url: item.content.url,
      publishedAt: item.content.publishedAt,
      collectedAt: item.content.collectedAt,
      membershipConfidence: confidence,
      role,
    });
    coveredSources.add(item.content.source);
    if (selected.length >= 4) {
      break;
    }
  }

  return selected;
}

function resolveRuntimeFallbackReason(
  itemCount: number,
  clusterConfidence: number,
  keywords: string[],
  memberships: TopicClusterMembership[],
): RuntimeTopicFallbackReason | undefined {
  if (itemCount < 2) {
    return "low-confidence";
  }
  if (keywords.length === 0) {
    return "insufficient-keywords";
  }
  if (clusterConfidence < 0.74) {
    return "low-confidence";
  }
  if (memberships.some((membership) => membership.reasoningTags.length === 0)) {
    return "candidate-conflict";
  }
  return undefined;
}

function clusterScore(
  cluster: ClusterCandidate,
  item: TopicClusterCandidateInput,
): PairDecision | null {
  const clusterRepos = uniqueSorted(
    cluster.items.flatMap((entry) => extractRepos(entry.content)),
  );
  const clusterEntities = uniqueSorted(
    cluster.items.flatMap((entry) => extractEntities(entry.content)),
  );
  const itemRepos = extractRepos(item.content);
  const itemEntities = extractEntities(item.content);

  if (
    clusterRepos.length > 0 &&
    itemRepos.length > 0 &&
    setOverlapCount(clusterRepos, itemRepos) === 0
  ) {
    return null;
  }
  if (
    clusterEntities.length > 0 &&
    itemEntities.length > 0 &&
    setOverlapCount(clusterEntities, itemEntities) === 0
  ) {
    return null;
  }

  return cluster.items.reduce<PairDecision | null>((best, existing) => {
    const candidate = evaluatePair(existing, item);
    if (!candidate) {
      return best;
    }
    if (!best || candidate.confidence > best.confidence) {
      return candidate;
    }
    return best;
  }, null);
}

export function clusterTopicContents(
  inputs: TopicClusterCandidateInput[],
): TopicClusterResult[] {
  const candidates = sortInputs(inputs);
  const clusters: ClusterCandidate[] = [];

  for (const input of candidates) {
    let bestCluster: ClusterCandidate | null = null;
    let bestScore: PairDecision | null = null;

    for (const cluster of clusters) {
      const score = clusterScore(cluster, input);
      if (!score) {
        continue;
      }
      if (!bestScore || score.confidence > bestScore.confidence) {
        bestCluster = cluster;
        bestScore = score;
      }
    }

    if (bestCluster) {
      bestCluster.items.push(input);
      continue;
    }

    clusters.push({ items: [input] });
  }

  return clusters.map((candidate) => {
    const anchor = pickAnchor(candidate.items);
    const signals = aggregateSignals(candidate.items);
    const slug = buildSlug(signals, anchor);
    const displayName = toDisplayName(slug, anchor);
    const stableKey = buildStableKey(anchor, signals);
    const topicClusterId = stableUuid(stableKey);
    const clusterVersion = buildClusterVersion(
      candidate.items,
      anchor.content.canonicalId,
    );
    const memberships = sortInputs(candidate.items).map<TopicClusterMembership>(
      (item, index) => {
        const decision = membershipConfidence(item, anchor);
        return {
          topicClusterId,
          clusterVersion,
          canonicalId: item.content.canonicalId,
          itemId: item.content.legacyRefs.itemId,
          embeddingRecordId: item.embeddingId,
          source: item.content.source,
          membershipConfidence: decision.confidence,
          primaryEvidence:
            item.content.canonicalId === anchor.content.canonicalId,
          evidenceRank: index + 1,
          reasoningTags: decision.reasoningTags,
          metadata: {
            fingerprint: item.content.fingerprint,
          },
        };
      },
    );
    const clusterConfidence = Number(
      (
        memberships.reduce(
          (sum, membership) => sum + membership.membershipConfidence,
          0,
        ) / memberships.length
      ).toFixed(4),
    );
    const representativeEvidence = buildRepresentativeEvidence(
      candidate.items,
      anchor,
    );
    const runtimeFallbackReason = resolveRuntimeFallbackReason(
      memberships.length,
      clusterConfidence,
      signals.keywords,
      memberships,
    );

    return {
      cluster: {
        topicClusterId,
        stableKey,
        clusterVersion,
        ruleVersion: TOPIC_CLUSTER_RULE_VERSION,
        status: "active",
        slug,
        displayName,
        summary: buildSummary(anchor, signals, memberships.length),
        keywords: signals.keywords,
        anchorCanonicalId: anchor.content.canonicalId,
        representativeEvidence,
        sourceMix: sourceMix(candidate.items),
        relatedRepos: signals.relatedRepos,
        relatedEntities: signals.relatedEntities,
        itemCount: memberships.length,
        clusterConfidence,
        runtimeFallbackReason,
        metadata: {
          anchorSource: anchor.content.source,
          anchorUrl: anchor.content.url,
        },
      },
      memberships,
    };
  });
}

export function buildRuntimeTopicSeedsFromTopicClusters(
  clusters: TopicCluster[],
  now = new Date(),
): RuntimeTopicSeed[] {
  const refreshedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  return clusters
    .filter(
      (cluster) =>
        cluster.status === "active" &&
        cluster.runtimeFallbackReason === undefined &&
        cluster.keywords.length > 0,
    )
    .sort((left, right) => {
      if (right.clusterConfidence === left.clusterConfidence) {
        return left.slug.localeCompare(right.slug);
      }
      return right.clusterConfidence - left.clusterConfidence;
    })
    .slice(0, MAX_RUNTIME_TOPIC_SEEDS)
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
      refreshedAt,
      expiresAt,
      metadata: {
        topicClusterId: cluster.topicClusterId,
        clusterVersion: cluster.clusterVersion,
        relatedRepos: cluster.relatedRepos,
        relatedEntities: cluster.relatedEntities,
      },
    }));
}
