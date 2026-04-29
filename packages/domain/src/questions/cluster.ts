import { createHash, randomUUID } from "node:crypto";
import type { QuestionCluster, QuestionEvidence } from "@devtrend/contracts";
import type { EnrichedItem } from "./extract.js";

export interface ClusteredQuestion {
  cluster: QuestionCluster;
  evidence: QuestionEvidence[];
  items: EnrichedItem[];
}

function pickCanonicalQuestion(items: EnrichedItem[]): string {
  return [...items].sort((left, right) => {
    const rightScore = right.item.score + right.item.commentCount;
    const leftScore = left.item.score + left.item.commentCount;
    return rightScore - leftScore;
  })[0].item.title;
}

function buildClusterKey(item: EnrichedItem): string {
  const entityPart = item.entities
    .map((entity) => entity.slug)
    .sort()
    .join("+");
  const topicPart = item.topics
    .map((topic) => topic.slug)
    .sort()
    .join("+");
  return `${entityPart}|${topicPart}|${item.question.repeatedSimilaritySeed}`;
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

export function clusterQuestionItems(
  items: EnrichedItem[],
): ClusteredQuestion[] {
  const bucket = new Map<string, EnrichedItem[]>();

  for (const item of items) {
    if (!item.question.isQuestion) {
      continue;
    }

    const key = buildClusterKey(item);
    const current = bucket.get(key) ?? [];
    current.push(item);
    bucket.set(key, current);
  }

  return [...bucket.entries()].map(([key, group]) => {
    const canonicalQuestion = pickCanonicalQuestion(group);
    const first = group[0];
    const sourceDistribution = buildSourceDistribution(group);
    const affectedTopics = [
      ...new Set(
        group.flatMap((item) => item.topics.map((topic) => topic.slug)),
      ),
    ];
    const affectedEntities = [
      ...new Set(
        group.flatMap((item) => item.entities.map((entity) => entity.slug)),
      ),
    ];
    const relatedRepos = [
      ...new Set(
        group.flatMap((item) =>
          item.entities.flatMap((entity) =>
            entity.repoName ? [entity.repoName] : [],
          ),
        ),
      ),
    ];
    const freshnessMinutes = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(first.item.publishedAt).getTime()) / (1000 * 60),
      ),
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
    }));

    return {
      cluster: {
        clusterId: stableClusterId(key),
        canonicalQuestion,
        growthLabel:
          group.length >= 4
            ? "growing"
            : group.length >= 2
              ? "steady"
              : "emerging",
        noveltyLabel: first.question.noveltyLabel,
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
