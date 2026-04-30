import type { RuntimeTopicSeed, SourceKey } from "@devtrend/contracts";
import {
  collectStaticSourceCommands,
  dynamicSourceCommandTemplates,
  type SourceCommandDefinition,
  sourceCommands,
} from "../command-registry.js";
import { normalizeSourcePayload } from "../normalizers/index.js";
import { runOpenCli, runOpenCliJson } from "../opencli.js";

export interface CollectedSourcePayload {
  source: string;
  commandName: string;
  argv: string[];
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  status: "success" | "fallback" | "failed";
  errorText: string | null;
  helpOutput: string;
  payload: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  fallbackSourceRunId?: string;
  fallbackSnapshotId?: string;
  fallbackCollectedAt?: string;
}

interface CollectionIdentity {
  id: string;
  name: string;
}

interface ExecutableSourceCommand {
  source: SourceKey;
  commandName: string;
  argv: string[];
  helpArgv: string[];
  metadata?: Record<string, unknown>;
}

interface QueryBudget {
  maxTopics: number;
  maxVariantsPerSourceTopic: number;
  maxDynamicCommandsPerSource: number;
}

export interface CollectLiveSourcePayloadOptions {
  openCliBin: string;
  timeoutMs: number;
  sources?: SourceKey[];
  runtimeTopics?: RuntimeTopicSeed[];
  topicSlugs?: string[];
  entitySlugs?: string[];
  entitySearchTerms?: string[];
  queryBudget?: Partial<QueryBudget>;
  mode?: "collect" | "audit";
}

type JsonRunner = (
  bin: string,
  argv: string[],
  timeoutMs: number,
) => Promise<Record<string, unknown>[]>;

const DEFAULT_QUERY_BUDGET: QueryBudget = {
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

function normalizeCollectionLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9+ ]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function isTagSafe(value: string): boolean {
  const normalized = normalizeSearchText(value);
  return (
    normalized.length >= 2 &&
    normalized.length <= 24 &&
    !normalized.includes(" ")
  );
}

function buildStaticArgv(command: SourceCommandDefinition): string[] {
  return [command.source, command.name, ...(command.args ?? [])];
}

function normalizeBudget(
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function querySourceLabel(
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

function simplifiedAlias(topicName: string): string | null {
  const tokens = normalizeSearchText(topicName).split(" ").filter(Boolean);
  const candidate = tokens.find(
    (token) => token.length > 2 && !GENERIC_TOPIC_TOKENS.has(token),
  );

  if (!candidate || candidate === normalizeSearchText(topicName)) {
    return null;
  }

  return candidate;
}

function topicSearchTerms(
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

function filterRuntimeTopics(
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

function buildExecutableCommands(
  options: CollectLiveSourcePayloadOptions,
): ExecutableSourceCommand[] {
  const budget = normalizeBudget(options.queryBudget);
  const sourceFilter = options.sources;

  if (options.mode === "audit") {
    const auditCommands =
      sourceFilter === undefined
        ? sourceCommands
        : sourceCommands.filter((command) =>
            sourceFilter.includes(command.source),
          );

    return auditCommands.map((command) => ({
      source: command.source,
      commandName: command.name,
      argv: buildStaticArgv(command),
      helpArgv: command.helpArgv,
    }));
  }

  const commands: ExecutableSourceCommand[] = [];
  const staticCommands =
    sourceFilter === undefined
      ? collectStaticSourceCommands
      : collectStaticSourceCommands.filter((command) =>
          sourceFilter.includes(command.source),
        );

  for (const command of staticCommands) {
    commands.push({
      source: command.source,
      commandName: command.name,
      argv: buildStaticArgv(command),
      helpArgv: command.helpArgv,
    });
  }

  const topics = filterRuntimeTopics(
    options.runtimeTopics ?? [],
    options.topicSlugs,
    budget,
  );
  const dynamicCounts = new Map<SourceKey, number>();

  for (const template of dynamicSourceCommandTemplates) {
    if (sourceFilter && !sourceFilter.includes(template.source)) {
      continue;
    }

    const currentCount = dynamicCounts.get(template.source) ?? 0;
    if (currentCount >= budget.maxDynamicCommandsPerSource) {
      continue;
    }

    if (template.expansion === "collection-adoption") {
      for (const topic of topics) {
        if (!topic.collectionId) {
          continue;
        }

        const sourceCount = dynamicCounts.get(template.source) ?? 0;
        if (sourceCount >= budget.maxDynamicCommandsPerSource) {
          break;
        }

        commands.push({
          source: template.source,
          commandName: template.name,
          argv: [
            template.source,
            template.name,
            topic.collectionId,
            "--limit",
            "5",
            "-f",
            "json",
          ],
          helpArgv: template.helpArgv,
          metadata: {
            topicSlug: topic.slug,
            query: topic.collectionId,
            querySource: querySourceLabel(topic),
            expansionReason: "collection-adoption",
            runtimeTopicSeedRunId: topic.runId,
          },
        });
        dynamicCounts.set(template.source, sourceCount + 1);
      }

      continue;
    }

    for (const topic of topics) {
      const terms = topicSearchTerms(topic, template.source, budget);

      for (const term of terms) {
        const sourceCount = dynamicCounts.get(template.source) ?? 0;
        if (sourceCount >= budget.maxDynamicCommandsPerSource) {
          break;
        }

        commands.push({
          source: template.source,
          commandName: template.name,
          argv: [
            template.source,
            template.name,
            term,
            "--limit",
            "5",
            "-f",
            "json",
          ],
          helpArgv: template.helpArgv,
          metadata: {
            topicSlug: topic.slug,
            query: term,
            querySource: querySourceLabel(topic),
            expansionReason:
              template.source === "devto" ? "topic-tag" : "topic-search",
            runtimeTopicSeedRunId: topic.runId,
          },
        });
        dynamicCounts.set(template.source, sourceCount + 1);
      }
    }
  }

  const entityTerms = uniqueStrings([
    ...(options.entitySearchTerms ?? []),
    ...(options.entitySlugs ?? []),
  ]);

  for (const source of ["stackoverflow", "hackernews"] as const) {
    if (sourceFilter && !sourceFilter.includes(source)) {
      continue;
    }

    for (const term of entityTerms) {
      const sourceCount = dynamicCounts.get(source) ?? 0;
      if (sourceCount >= budget.maxDynamicCommandsPerSource) {
        break;
      }

      commands.push({
        source,
        commandName: "search",
        argv: [source, "search", term, "--limit", "5", "-f", "json"],
        helpArgv: [source, "search", "--help"],
        metadata: {
          query: term,
          querySource: "fallback-topics",
          expansionReason: "entity-search",
        },
      });
      dynamicCounts.set(source, sourceCount + 1);
    }
  }

  return commands;
}

async function loadOssInsightCollections(
  openCliBin: string,
  timeoutMs: number,
  runJson: JsonRunner,
): Promise<CollectionIdentity[]> {
  const [collections, hotCollections] = await Promise.all([
    runJson(
      openCliBin,
      ["ossinsight", "collections", "--limit", "100", "-f", "json"],
      timeoutMs,
    ),
    runJson(
      openCliBin,
      ["ossinsight", "hot-collections", "--limit", "100", "-f", "json"],
      timeoutMs,
    ),
  ]);

  return [...collections, ...hotCollections]
    .map((entry) => ({
      id: String(entry.id ?? ""),
      name: String(entry.name ?? ""),
    }))
    .filter((entry) => entry.id.length > 0 && entry.name.length > 0);
}

export async function resolveSourceCommandArgv(
  command: SourceCommandDefinition,
  openCliBin: string,
  timeoutMs: number,
  collectionCache = new Map<string, string>(),
  runJson: JsonRunner = runOpenCliJson<Record<string, unknown>[]>,
): Promise<string[]> {
  if (
    command.source !== "ossinsight" ||
    command.collectionTargetName === undefined
  ) {
    return buildStaticArgv(command);
  }

  const lookupKey = normalizeCollectionLookupKey(command.collectionTargetName);
  let collectionId = collectionCache.get(lookupKey);

  if (collectionId === undefined) {
    const collections = await loadOssInsightCollections(
      openCliBin,
      timeoutMs,
      runJson,
    );

    const match = collections.find(
      (entry) =>
        entry.name === command.collectionTargetName ||
        normalizeCollectionLookupKey(entry.name) === lookupKey,
    );

    if (!match) {
      throw new Error(
        `Unable to resolve OSSInsight collection id for ${command.collectionTargetName}`,
      );
    }

    collectionId = match.id;
    collectionCache.set(lookupKey, collectionId);
  }

  return [command.source, command.name, collectionId, ...(command.args ?? [])];
}

export async function collectLiveSourcePayloads(
  options: CollectLiveSourcePayloadOptions,
  runText: typeof runOpenCli = runOpenCli,
  runJson: JsonRunner = runOpenCliJson<Record<string, unknown>[]>,
): Promise<CollectedSourcePayload[]> {
  const results: CollectedSourcePayload[] = [];
  const commands = buildExecutableCommands(options);

  for (const command of commands) {
    const startedAt = new Date().toISOString();

    try {
      const [helpResult, payloadResult] = await Promise.allSettled([
        runText(options.openCliBin, command.helpArgv, options.timeoutMs),
        runJson(options.openCliBin, command.argv, options.timeoutMs),
      ]);
      const finishedAt = new Date().toISOString();
      const latencyMs =
        new Date(finishedAt).getTime() - new Date(startedAt).getTime();

      if (payloadResult.status === "fulfilled") {
        const helpOutput =
          helpResult.status === "fulfilled" ? helpResult.value : "";
        const errorText =
          helpResult.status === "rejected" ? String(helpResult.reason) : null;

        results.push({
          source: command.source,
          commandName: command.commandName,
          argv: command.argv,
          startedAt,
          finishedAt,
          latencyMs,
          status: "success",
          errorText,
          helpOutput,
          payload: payloadResult.value,
          metadata: command.metadata,
        });
        continue;
      }

      results.push({
        source: command.source,
        commandName: command.commandName,
        argv: command.argv,
        startedAt,
        finishedAt,
        latencyMs,
        status: "failed",
        errorText: String(payloadResult.reason),
        helpOutput: helpResult.status === "fulfilled" ? helpResult.value : "",
        payload: [],
        metadata: command.metadata,
      });
    } catch (error) {
      const finishedAt = new Date().toISOString();
      results.push({
        source: command.source,
        commandName: command.commandName,
        argv: command.argv,
        startedAt,
        finishedAt,
        latencyMs:
          new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        status: "failed",
        errorText: error instanceof Error ? error.message : String(error),
        helpOutput: "",
        payload: [],
        metadata: command.metadata,
      });
    }
  }

  return results;
}

export function normalizeCollectedPayloads(payloads: CollectedSourcePayload[]) {
  return payloads.flatMap((payload) => {
    if (payload.status === "failed") {
      return [];
    }

    return normalizeSourcePayload(
      payload.source as never,
      payload.commandName,
      payload.payload,
    ).map((item) => ({
      ...item,
      rawMeta: {
        ...item.rawMeta,
        ...(payload.metadata ?? {}),
      },
    }));
  });
}
