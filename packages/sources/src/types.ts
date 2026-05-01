import type {
  NormalizedItem,
  RuntimeTopicSeed,
  SourceKey,
} from "@devtrend/contracts";

export type SourceCapability =
  | "feed"
  | "search"
  | "topic-discovery"
  | "adoption";

export type SourceRouteRole = "primary" | "backup";

export type SourceTaskExecutionDecision =
  | "executed"
  | "skipped-open-circuit"
  | "fallback-snapshot";

export interface SourceTask {
  taskKey: string;
  source: SourceKey;
  capability: SourceCapability;
  commandName: string;
  argv: string[];
  helpArgv: string[];
  breakerKey: string;
  adapterKey: string;
  routeRole: SourceRouteRole;
  taskFamily: string;
  metadata?: Record<string, unknown>;
}

export interface QueryBudget {
  maxTopics: number;
  maxVariantsPerSourceTopic: number;
  maxDynamicCommandsPerSource: number;
}

export interface SourceTaskBuildContext {
  mode: "collect" | "audit";
  runtimeTopics: RuntimeTopicSeed[];
  topicSlugs?: string[];
  entitySlugs?: string[];
  entitySearchTerms?: string[];
  queryBudget: QueryBudget;
}

export interface RuntimeTopicCandidate {
  slug: string;
  name: string;
  keywords: string[];
  sourcePriority: number;
  sources: (
    | "ossinsight-hot"
    | "ossinsight-collections"
    | "devto-top"
    | "fallback-topics"
  )[];
  collectionId?: string;
  devtoTags: string[];
  score: number;
  metadata: Record<string, unknown>;
}

export interface RuntimeTopicDiscoverySourceStatus {
  source: "ossinsight" | "devto";
  status: "success" | "failed";
  errorText: string | null;
  candidateCount: number;
}

export interface RuntimeTopicDiscoveryResult {
  candidates: RuntimeTopicCandidate[];
  sourceStatuses: RuntimeTopicDiscoverySourceStatus[];
}

export type JsonRunner = (
  bin: string,
  argv: string[],
  timeoutMs: number,
) => Promise<Record<string, unknown>[]>;

export interface RuntimeTopicDiscoveryContext {
  openCliBin: string;
  timeoutMs: number;
  runJson: JsonRunner;
}

export interface SourceAdapter {
  key: string;
  source: SourceKey;
  supports: SourceCapability[];
  buildStaticTasks(context: SourceTaskBuildContext): SourceTask[];
  buildDynamicTasks(context: SourceTaskBuildContext): SourceTask[];
  normalize(
    task: Pick<
      SourceTask,
      "source" | "commandName" | "capability" | "metadata"
    >,
    entries: Record<string, unknown>[],
  ): NormalizedItem[];
  discoverRuntimeTopics?(
    context: RuntimeTopicDiscoveryContext,
  ): Promise<RuntimeTopicDiscoveryResult>;
}

export interface SourceRoutePolicy {
  source: SourceKey;
  capability: SourceCapability;
  taskFamily?: string;
  primaryAdapterKey: string;
  backupAdapterKeys: string[];
}

export interface SourceAdapterRegistry {
  adapters: SourceAdapter[];
  routePolicies: SourceRoutePolicy[];
}

export type CircuitBreakerStatus = "closed" | "open" | "half-open";

export interface CircuitBreakerState {
  status: CircuitBreakerStatus;
  consecutiveFailures: number;
  openedAt: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  trialInProgress: boolean;
}

export interface CircuitBreakerStore {
  get(key: string): Promise<CircuitBreakerState | null>;
  allowRequest(key: string, now?: Date): Promise<boolean>;
  recordSuccess(key: string, now?: Date): Promise<CircuitBreakerState>;
  recordFailure(key: string, now?: Date): Promise<CircuitBreakerState>;
}
