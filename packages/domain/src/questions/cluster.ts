import { createHash, randomUUID } from "node:crypto";
import type { QuestionCluster, QuestionEvidence } from "@devtrend/contracts";
import type { EnrichedItem } from "./extract.js";
import { normalizeQuestionTitle } from "./extract.js";

const CLUSTER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_TOKEN_JACCARD = 0.3;
const MIN_TRIGRAM_DICE = 0.4;
const TITLE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "we",
  "what",
  "why",
  "with",
  "you",
]);

export interface ClusteredQuestion {
  cluster: QuestionCluster;
  evidence: QuestionEvidence[];
  items: EnrichedItem[];
}

interface ClusterCandidate {
  items: EnrichedItem[];
}

interface PairScore {
  score: number;
}

function pickCanonicalQuestion(items: EnrichedItem[]): string {
  return [...items].sort((left, right) => {
    const rightScore = right.item.score + right.item.commentCount;
    const leftScore = left.item.score + left.item.commentCount;
    return rightScore - leftScore;
  })[0].item.title;
}

function buildSourceDistribution(
  items: EnrichedItem[],
): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.item.source] = (accumulator[item.item.source] ?? 0) + 1;
    return accumulator;
  }, {});
}

function stableClusterId(key: string): string {
  const hex = createHash("sha1").update(`cluster:${key}`).digest("hex");
  const chars = hex.slice(0, 32).split("");

  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8).toString(
    16,
  );

  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

function titleTokens(item: EnrichedItem): Set<string> {
  return new Set(
    normalizeQuestionTitle(item.item.title).split(" ").filter(Boolean),
  );
}

function trigramSet(item: EnrichedItem): Set<string> {
  const normalized = `  ${normalizeQuestionTitle(item.item.title)} `;
  const trigrams = new Set<string>();

  for (let index = 0; index < normalized.length - 2; index += 1) {
    trigrams.add(normalized.slice(index, index + 3));
  }

  return trigrams;
}

function normalizeClusterToken(token: string): string {
  if (token.length > 4 && token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
}

function significantTitleTokens(item: EnrichedItem): string[] {
  return normalizeQuestionTitle(item.item.title)
    .split(" ")
    .map(normalizeClusterToken)
    .filter((token) => token.length > 2 && !TITLE_STOPWORDS.has(token));
}

function normalizedTags(item: EnrichedItem): string[] {
  return item.item.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function trigramDiceSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const intersection = [...left].filter((token) => right.has(token)).length;
  return (2 * intersection) / (left.size + right.size);
}

function overlapCount(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

function comparePair(
  left: EnrichedItem,
  right: EnrichedItem,
): PairScore | null {
  const leftPublishedAt = new Date(left.item.publishedAt).getTime();
  const rightPublishedAt = new Date(right.item.publishedAt).getTime();

  if (Math.abs(leftPublishedAt - rightPublishedAt) > CLUSTER_WINDOW_MS) {
    return null;
  }

  const exactSignature =
    left.question.repeatedSimilaritySeed ===
    right.question.repeatedSimilaritySeed;
  const tokenJaccard = jaccardSimilarity(titleTokens(left), titleTokens(right));
  const trigramDice = trigramDiceSimilarity(
    trigramSet(left),
    trigramSet(right),
  );
  const sharedEntities = overlapCount(
    left.entities.map((entity) => entity.slug),
    right.entities.map((entity) => entity.slug),
  );
  const sharedTopics = overlapCount(
    left.topics.map((topic) => topic.slug),
    right.topics.map((topic) => topic.slug),
  );
  const sharedTags = overlapCount(normalizedTags(left), normalizedTags(right));
  const sharedSignificantTokens = overlapCount(
    significantTitleTokens(left),
    significantTitleTokens(right),
  );
  const titleMatches =
    exactSignature ||
    (tokenJaccard >= MIN_TOKEN_JACCARD && trigramDice >= MIN_TRIGRAM_DICE) ||
    (sharedSignificantTokens >= 2 &&
      (sharedEntities > 0 || sharedTopics > 0 || sharedTags > 0));
  const anchorMatches =
    sharedEntities > 0 ||
    sharedTopics > 0 ||
    exactSignature ||
    (sharedTags > 0 && trigramDice >= MIN_TRIGRAM_DICE);

  if (!titleMatches || !anchorMatches) {
    return null;
  }

  return {
    score:
      (exactSignature ? 100 : 0) +
      sharedEntities * 10 +
      sharedTopics * 5 +
      sharedTags * 3 +
      sharedSignificantTokens * 4 +
      trigramDice * 3 +
      tokenJaccard * 2,
  };
}

function clusterScore(
  cluster: ClusterCandidate,
  item: EnrichedItem,
): PairScore | null {
  return cluster.items.reduce<PairScore | null>((best, existing) => {
    const candidate = comparePair(existing, item);
    if (!candidate) {
      return best;
    }

    if (!best || candidate.score > best.score) {
      return candidate;
    }

    return best;
  }, null);
}

function sortItems(items: EnrichedItem[]): EnrichedItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [
      normalizeQuestionTitle(left.item.title),
      left.item.publishedAt,
      left.item.source,
      left.item.sourceItemId,
    ].join("|");
    const rightKey = [
      normalizeQuestionTitle(right.item.title),
      right.item.publishedAt,
      right.item.source,
      right.item.sourceItemId,
    ].join("|");
    return leftKey.localeCompare(rightKey);
  });
}

function buildClusterFingerprint(items: EnrichedItem[]): string {
  const signatures = [
    ...new Set(items.map((item) => item.question.repeatedSimilaritySeed)),
  ].sort();
  const entities = [
    ...new Set(
      items.flatMap((item) => item.entities.map((entity) => entity.slug)),
    ),
  ].sort();
  const topics = [
    ...new Set(items.flatMap((item) => item.topics.map((topic) => topic.slug))),
  ].sort();
  const firstPublishedDay = [...items]
    .map((item) => item.item.publishedAt.slice(0, 10))
    .sort()[0];

  return [
    firstPublishedDay,
    signatures.join("~"),
    entities.join("+"),
    topics.join("+"),
  ].join("|");
}

function latestPublishedAt(items: EnrichedItem[]): number {
  return Math.max(
    ...items.map((item) => new Date(item.item.publishedAt).getTime()),
  );
}

export function clusterQuestionItems(
  items: EnrichedItem[],
): ClusteredQuestion[] {
  const clusters: ClusterCandidate[] = [];

  for (const item of sortItems(items)) {
    if (!item.question.isQuestion) {
      continue;
    }

    let bestCluster: ClusterCandidate | null = null;
    let bestScore: PairScore | null = null;

    for (const cluster of clusters) {
      const candidate = clusterScore(cluster, item);
      if (!candidate) {
        continue;
      }

      if (!bestScore || candidate.score > bestScore.score) {
        bestCluster = cluster;
        bestScore = candidate;
      }
    }

    if (bestCluster) {
      bestCluster.items.push(item);
      continue;
    }

    clusters.push({ items: [item] });
  }

  return clusters.map((candidate) => {
    const group = sortItems(candidate.items);
    const canonicalQuestion = pickCanonicalQuestion(group);
    const sourceDistribution = buildSourceDistribution(group);
    const affectedTopics = [
      ...new Set(
        group.flatMap((item) => item.topics.map((topic) => topic.slug)),
      ),
    ].sort();
    const affectedEntities = [
      ...new Set(
        group.flatMap((item) => item.entities.map((entity) => entity.slug)),
      ),
    ].sort();
    const relatedRepos = [
      ...new Set(
        group.flatMap((item) =>
          item.entities.flatMap((entity) =>
            entity.repoName ? [entity.repoName] : [],
          ),
        ),
      ),
    ].sort();
    const freshnessMinutes = Math.max(
      0,
      Math.floor((Date.now() - latestPublishedAt(group)) / (1000 * 60)),
    );
    const evidence = group.map<QuestionEvidence>((item) => ({
      id: randomUUID(),
      itemId: item.item.id,
      source: item.item.source,
      title: item.item.title,
      url: item.item.url,
      label: item.item.contentType,
      score: item.item.score,
      publishedAt: item.item.publishedAt,
      collectedAt: item.item.collectedAt,
      sourceRunId:
        typeof item.item.rawMeta.sourceRunId === "string"
          ? item.item.rawMeta.sourceRunId
          : null,
      snapshotId:
        typeof item.item.rawMeta.snapshotId === "string"
          ? item.item.rawMeta.snapshotId
          : null,
    }));
    const clusterKey = buildClusterFingerprint(group);

    return {
      cluster: {
        clusterId: stableClusterId(clusterKey),
        canonicalQuestion,
        growthLabel:
          group.length >= 4
            ? "growing"
            : group.length >= 2
              ? "steady"
              : "emerging",
        noveltyLabel: group[0]?.question.noveltyLabel ?? "recurring-pain",
        affectedTopics,
        affectedEntities,
        relatedRepos,
        sourceDistribution,
        evidenceCount: evidence.length,
        confidenceScore: 0,
        freshnessMinutes,
        fallbackUsed: false,
        recommendedAction: "Investigate feature gap",
      },
      evidence,
      items: group,
    };
  });
}
