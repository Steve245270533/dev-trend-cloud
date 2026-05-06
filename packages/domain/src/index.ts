import type {
  FeedItem,
  NormalizedItem,
  QuestionEvidence,
  QuestionPressureSignal,
  SourceFeatures,
  SourceStatus,
  UnifiedContentRecord,
} from "@devtrend/contracts";
import { matchCatalog } from "./matching/matcher.js";
import { clusterQuestionItems } from "./questions/cluster.js";
import { extractQuestionFeatures } from "./questions/extract.js";
import { scoreClusters } from "./scoring/question-pressure.js";
import {
  buildRuntimeTopicSeedsFromTopicClusters,
  clusterTopicContents,
  TOPIC_CLUSTER_RULE_VERSION,
} from "./topics/cluster.js";
import {
  buildEmbeddingInput,
  buildEmbeddingInputFromUnifiedContent,
  isEmbeddingInputRecord,
  isUnifiedContentRecord,
  isValidSourceFeatures,
} from "./unified-content.js";

export { entitySeeds, topicSeeds, watchlistSeeds } from "./matching/catalog.js";
export type { SourceFeatures, UnifiedContentRecord };
export {
  buildEmbeddingInput,
  buildEmbeddingInputFromUnifiedContent,
  buildRuntimeTopicSeedsFromTopicClusters,
  clusterTopicContents,
  isEmbeddingInputRecord,
  isUnifiedContentRecord,
  isValidSourceFeatures,
  TOPIC_CLUSTER_RULE_VERSION,
};

export interface PipelineOutput {
  feed: FeedItem[];
  signals: QuestionPressureSignal[];
  evidenceByClusterId: Record<string, QuestionEvidence[]>;
}

export function buildQuestionPressurePipeline(
  items: NormalizedItem[],
  sourceStatus: Record<string, SourceStatus>,
): PipelineOutput {
  const feed = items.map<FeedItem>((item) => {
    const matches = matchCatalog(item);
    return {
      ...item,
      topics: matches.topics,
      entities: matches.entities,
    };
  });

  const enriched = feed.map((item) => ({
    item,
    topics: item.topics,
    entities: item.entities,
    question: extractQuestionFeatures(item, item.topics, item.entities),
  }));

  const clusters = clusterQuestionItems(enriched);
  const signals = scoreClusters(clusters, sourceStatus);
  const evidenceByClusterId = clusters.reduce<
    Record<string, QuestionEvidence[]>
  >((accumulator, cluster) => {
    accumulator[cluster.cluster.clusterId] = cluster.evidence;
    return accumulator;
  }, {});

  return {
    feed,
    signals,
    evidenceByClusterId,
  };
}
