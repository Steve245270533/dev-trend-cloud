import type {
  FeedItem,
  FeedQuery,
  QuestionCluster,
  QuestionEvidence,
  QuestionPressureQuery,
  QuestionPressureSignal,
  SourceStatus,
} from "@devtrend/contracts";

export interface ReadServices {
  checkHealth: () => Promise<boolean>;
  checkReadiness: () => Promise<boolean>;
  getSourceStatus: () => Promise<Record<string, SourceStatus>>;
  getFeed: (query: FeedQuery) => Promise<FeedItem[]>;
  getQuestionPressure: (
    query: QuestionPressureQuery,
  ) => Promise<QuestionPressureSignal[]>;
  getQuestionCluster: (clusterId: string) => Promise<QuestionCluster | null>;
  getQuestionEvidence: (
    clusterId: string,
    limit?: number,
  ) => Promise<QuestionEvidence[]>;
}
