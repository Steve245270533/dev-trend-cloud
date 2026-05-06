import { createHash, randomUUID } from "node:crypto";
import type {
  NormalizedItem,
  RuntimeTopicSeed,
  SourceFeatures,
  SourceKey,
} from "@devtrend/contracts";
import type {
  QueryBudget,
  SourceCapability,
  SourceRouteRole,
  SourceTask,
  SourceTaskBuildContext,
} from "../types.js";

export const DEFAULT_QUERY_BUDGET: QueryBudget = {
  maxTopics: 12,
  maxVariantsPerSourceTopic: 2,
  maxDynamicCommandsPerSource: 24,
};

const GENERIC_TOPIC_TOKENS = new Set([
  "open",
  "source",
  "framework",
  "frameworks",
  "tool",
  "tools",
  "database",
  "databases",
  "javascript",
  "web",
  "react",
  "developer",
  "developers",
]);

export function normalizeBudget(
  budget: Partial<QueryBudget> | undefined,
): QueryBudget {
  return {
    maxTopics: Math.max(1, budget?.maxTopics ?? DEFAULT_QUERY_BUDGET.maxTopics),
    maxVariantsPerSourceTopic: Math.max(
      1,
      budget?.maxVariantsPerSourceTopic ??
        DEFAULT_QUERY_BUDGET.maxVariantsPerSourceTopic,
    ),
    maxDynamicCommandsPerSource: Math.max(
      1,
      budget?.maxDynamicCommandsPerSource ??
        DEFAULT_QUERY_BUDGET.maxDynamicCommandsPerSource,
    ),
  };
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9+ ]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function normalizeCollectionLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function isTagSafe(value: string): boolean {
  const normalized = normalizeSearchText(value);
  return (
    normalized.length >= 2 &&
    normalized.length <= 24 &&
    !normalized.includes(" ")
  );
}

export function querySourceLabel(
  topic: RuntimeTopicSeed,
): "ossinsight" | "devto" | "fallback-topics" {
  if (
    topic.sources.includes("ossinsight-hot") ||
    topic.sources.includes("ossinsight-collections")
  ) {
    return "ossinsight";
  }

  if (topic.sources.includes("devto-top")) {
    return "devto";
  }

  return "fallback-topics";
}

export function simplifiedAlias(topicName: string): string | null {
  const tokens = normalizeSearchText(topicName).split(" ").filter(Boolean);
  const candidate = tokens.find(
    (token) => token.length > 2 && !GENERIC_TOPIC_TOKENS.has(token),
  );

  if (!candidate || candidate === normalizeSearchText(topicName)) {
    return null;
  }

  return candidate;
}

export function topicSearchTerms(
  topic: RuntimeTopicSeed,
  source: SourceKey,
  budget: QueryBudget,
): string[] {
  if (source === "devto") {
    const tags = topic.devtoTags.filter(isTagSafe);
    if (tags.length > 0) {
      return tags.slice(0, budget.maxVariantsPerSourceTopic);
    }

    const fallbackTag = topic.keywords.find(isTagSafe);
    return fallbackTag ? [fallbackTag] : [];
  }

  const terms = [topic.name];

  if (source === "hackernews") {
    const alias = simplifiedAlias(topic.name);
    if (alias) {
      terms.push(alias);
    }
  } else if (source === "stackoverflow") {
    const keyword = topic.keywords.find(
      (value) => normalizeSearchText(value) !== normalizeSearchText(topic.name),
    );
    if (keyword) {
      terms.push(keyword);
    }
  }

  return uniqueStrings(terms).slice(0, budget.maxVariantsPerSourceTopic);
}

export function filterRuntimeTopics(
  runtimeTopics: RuntimeTopicSeed[],
  topicSlugs: string[] | undefined,
  budget: QueryBudget,
): RuntimeTopicSeed[] {
  const allowedSlugs = topicSlugs ? new Set(topicSlugs) : null;
  return runtimeTopics
    .filter((topic) => (allowedSlugs ? allowedSlugs.has(topic.slug) : true))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.slug.localeCompare(right.slug);
    })
    .slice(0, budget.maxTopics);
}

export function buildTaskKey(argv: string[], adapterKey: string): string {
  return `${adapterKey}:${argv.join(" ")}`;
}

export function buildBreakerKey(
  source: SourceKey,
  capability: SourceCapability,
  taskFamily: string,
): string {
  return `${source}:${capability}:${taskFamily}`;
}

export function createSourceTask(input: {
  source: SourceKey;
  capability: SourceCapability;
  commandName: string;
  argv: string[];
  helpArgv: string[];
  adapterKey: string;
  routeRole?: SourceRouteRole;
  taskFamily?: string;
  metadata?: Record<string, unknown>;
}): SourceTask {
  const taskFamily = input.taskFamily ?? input.commandName;
  const routeRole = input.routeRole ?? "primary";

  return {
    taskKey: buildTaskKey(input.argv, input.adapterKey),
    source: input.source,
    capability: input.capability,
    commandName: input.commandName,
    argv: input.argv,
    helpArgv: input.helpArgv,
    breakerKey: buildBreakerKey(input.source, input.capability, taskFamily),
    adapterKey: input.adapterKey,
    routeRole,
    taskFamily,
    metadata: input.metadata,
  };
}

export function toIsoDate(value: unknown): string | null {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const epochMs = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(epochMs);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

export function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export function normalizeUrl(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

export function resolvePublishedAt(
  collectedAt: string,
  ...values: unknown[]
): Pick<NormalizedItem, "publishedAt" | "timestampOrigin"> {
  for (const value of values) {
    const publishedAt = toIsoDate(value);
    if (publishedAt) {
      return {
        publishedAt,
        timestampOrigin: "source",
      };
    }
  }

  return {
    publishedAt: collectedAt,
    timestampOrigin: "collected",
  };
}

export function isExplicitQuestionTitle(title: string): boolean {
  const normalizedTitle = title.trim();
  return (
    /\?$/.test(normalizedTitle) ||
    /^(how|why|what|when|where|who|which|can|does|do|is|are)\b/i.test(
      normalizedTitle,
    )
  );
}

export function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

export function baseItem(
  source: SourceKey,
  sourceItemId: string,
  overrides: Partial<NormalizedItem>,
): NormalizedItem {
  const collectedAt = new Date().toISOString();
  return {
    id: randomUUID(),
    source,
    sourceItemId,
    title: "Untitled",
    summary: "",
    url: "",
    publishedAt: collectedAt,
    collectedAt,
    timestampOrigin: "collected",
    score: 0,
    answerCount: 0,
    commentCount: 0,
    tags: [],
    contentType: "feed",
    isQuestion: false,
    rawMeta: {},
    ...overrides,
  };
}

function normalizeForFingerprint(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9 ]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function buildUnifiedFingerprint(input: {
  source: SourceKey;
  sourceItemId: string;
  title: string;
  summary: string;
  url: string;
}): string {
  const canonicalText = [
    input.source,
    input.sourceItemId,
    normalizeForFingerprint(input.title),
    normalizeForFingerprint(input.summary),
    input.url.trim().toLowerCase(),
  ].join("|");

  return `sha256:${createHash("sha256").update(canonicalText).digest("hex")}`;
}

export function composeUnifiedRawMeta(input: {
  source: SourceKey;
  sourceItemId: string;
  title: string;
  summary: string;
  url: string;
  bodyExcerpt?: string;
  sourceFeatures: SourceFeatures;
  evidenceRefs?: string[];
}): {
  canonicalId: string;
  bodyExcerpt?: string;
  sourceFeatures: SourceFeatures;
  fingerprint: string;
  evidenceRefs: string[];
} {
  const evidenceRefs = uniqueStrings(
    (input.evidenceRefs ?? []).filter((ref) => ref.trim().length > 0),
  );
  if (input.url.trim().length > 0) {
    evidenceRefs.unshift(input.url.trim());
  }

  return {
    canonicalId: `${input.source}:${input.sourceItemId}`,
    bodyExcerpt: input.bodyExcerpt,
    sourceFeatures: input.sourceFeatures,
    fingerprint: buildUnifiedFingerprint({
      source: input.source,
      sourceItemId: input.sourceItemId,
      title: input.title,
      summary: input.summary,
      url: input.url,
    }),
    evidenceRefs: uniqueStrings(evidenceRefs),
  };
}

export function buildSourceTaskContext(
  input: Omit<SourceTaskBuildContext, "queryBudget"> & {
    queryBudget?: Partial<QueryBudget>;
  },
): SourceTaskBuildContext {
  return {
    ...input,
    queryBudget: normalizeBudget(input.queryBudget),
  };
}
