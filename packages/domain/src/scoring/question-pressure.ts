import type { QuestionPressureSignal, SourceStatus } from "@devtrend/contracts";
import type { ClusteredQuestion } from "../questions/cluster.js";

function recommendedAction(cluster: ClusteredQuestion): string {
  const stackOverflowCount = cluster.items.filter(
    (item) => item.item.source === "stackoverflow",
  ).length;
  const devtoCount = cluster.items.filter(
    (item) => item.item.source === "devto",
  ).length;
  const ossinsightCount = cluster.items.filter(
    (item) => item.item.source === "ossinsight",
  ).length;

  if (stackOverflowCount >= 2) {
    return "Fix docs";
  }

  if (devtoCount >= 1 && cluster.cluster.growthLabel !== "emerging") {
    return "Write content";
  }

  if (ossinsightCount >= 1) {
    return "Watch competitor";
  }

  return "Investigate feature gap";
}

function averageHealth(
  sourceStatus: Record<string, SourceStatus>,
  cluster: ClusteredQuestion,
): number {
  const statuses = [...new Set(cluster.items.map((item) => item.item.source))]
    .map((source) => sourceStatus[source])
    .filter((value): value is SourceStatus => Boolean(value));

  if (statuses.length === 0) {
    return 0.5;
  }

  const score = statuses.reduce((total, status) => {
    if (status.status === "healthy") {
      return total + 1;
    }

    if (status.status === "degraded") {
      return total + 0.6;
    }

    return total + 0.2;
  }, 0);

  return score / statuses.length;
}

export function scoreClusters(
  clusters: ClusteredQuestion[],
  sourceStatus: Record<string, SourceStatus>,
): QuestionPressureSignal[] {
  return clusters.map((cluster) => {
    const unresolvedVolume = cluster.items.reduce(
      (total, item) => total + item.question.unresolvedVolume,
      0,
    );
    const repeatedQuestionSimilarity = Math.max(0, cluster.items.length - 1);
    const crossSourceMentions = Object.keys(
      cluster.cluster.sourceDistribution,
    ).length;
    const affectedEntityWeight = Math.max(
      1,
      cluster.cluster.affectedEntities.length,
    );
    const sourceHealthWeight = averageHealth(sourceStatus, cluster);
    const bountyOrHighScoreBoost = cluster.items.some(
      (item) => item.item.contentType === "bounty" || item.item.score >= 10,
    )
      ? 2
      : 0.5;
    const recentGrowth =
      cluster.cluster.growthLabel === "growing"
        ? 3
        : cluster.cluster.growthLabel === "steady"
          ? 2
          : 1;

    const pressureScore =
      unresolvedVolume +
      bountyOrHighScoreBoost +
      repeatedQuestionSimilarity +
      recentGrowth +
      crossSourceMentions +
      affectedEntityWeight +
      sourceHealthWeight;

    const baseConfidence = Math.min(
      1,
      0.2 +
        cluster.cluster.evidenceCount * 0.1 +
        crossSourceMentions * 0.15 +
        sourceHealthWeight * 0.15,
    );
    const confidenceCap = cluster.cluster.evidenceCount < 3 ? 0.45 : 1;
    const confidenceScore = Number(
      Math.min(baseConfidence, confidenceCap).toFixed(3),
    );

    return {
      ...cluster.cluster,
      pressureScore: Number(pressureScore.toFixed(3)),
      unresolvedVolume,
      confidenceScore,
      recommendedAction: recommendedAction(cluster),
      fallbackUsed: cluster.items.some(
        (item) => item.item.rawMeta.fallbackUsed === true,
      ),
    };
  });
}
