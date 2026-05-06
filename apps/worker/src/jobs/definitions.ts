import type { SourceKey } from "@devtrend/contracts";
import type { CollectedSourcePayload } from "@devtrend/sources";

export const QUEUES = {
  contractAudit: "contract-audit",
  topicSeedRefresh: "topic-seed-refresh",
  collect: "collect",
  normalize: "normalize",
  match: "match",
  cluster: "cluster",
  score: "score",
} as const;

export interface ContractAuditJobData {
  source?: SourceKey;
  bootstrap?: boolean;
}

export interface TopicSeedRefreshJobData {
  bootstrap?: boolean;
}

export interface CollectJobData {
  source?: SourceKey;
  bootstrap?: boolean;
}

export interface PipelineStageJobData {
  source?: SourceKey;
  bootstrap?: boolean;
  payloads: CollectedSourcePayload[];
  contractVersion: "worker-pipeline-v1";
}

export function createPipelineStageJobData(input: {
  source?: SourceKey;
  bootstrap?: boolean;
  payloads: CollectedSourcePayload[];
}): PipelineStageJobData {
  return {
    source: input.source,
    bootstrap: input.bootstrap ?? false,
    payloads: input.payloads,
    contractVersion: "worker-pipeline-v1",
  };
}
