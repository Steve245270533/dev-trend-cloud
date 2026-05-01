import type { RuntimeTopicSeed, SourceKey } from "@devtrend/contracts";
import {
  buildSourceTaskContext,
  normalizeCollectionLookupKey,
} from "../adapters/shared.js";
import { createNoopCircuitBreakerStore } from "../breakers.js";
import {
  commandCategoryToCapability,
  getSourceCommandDefinition,
  type SourceCommandDefinition,
  sourceCommands,
} from "../command-registry.js";
import { runOpenCli, runOpenCliJson } from "../opencli.js";
import {
  defaultSourceAdapterRegistry,
  getPrimaryAdapterForRoute,
  getSourceAdapterByKey,
  listSourceAdapters,
} from "../registry.js";
import type {
  CircuitBreakerStore,
  JsonRunner,
  QueryBudget,
  SourceAdapterRegistry,
  SourceTask,
  SourceTaskExecutionDecision,
} from "../types.js";

export interface CollectedSourcePayload {
  source: SourceKey;
  capability: SourceTask["capability"];
  taskKey: string;
  breakerKey: string;
  adapterKey: string;
  routeRole: SourceTask["routeRole"];
  executionDecision: SourceTaskExecutionDecision;
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
  breakerStore?: CircuitBreakerStore;
  adapterRegistry?: SourceAdapterRegistry;
}

function buildStaticArgv(command: SourceCommandDefinition): string[] {
  return [command.source, command.name, ...(command.args ?? [])];
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

async function buildAuditTasks(
  options: CollectLiveSourcePayloadOptions,
  registry: SourceAdapterRegistry,
  runJson: JsonRunner,
): Promise<SourceTask[]> {
  const commands =
    options.sources === undefined
      ? sourceCommands
      : sourceCommands.filter((command) =>
          options.sources?.includes(command.source),
        );
  const collectionCache = new Map<string, string>();
  const tasks: SourceTask[] = [];

  for (const command of commands) {
    const adapter = getPrimaryAdapterForRoute(
      command.source,
      commandCategoryToCapability(command.category),
      registry,
      command.name,
    );
    const argv = await resolveSourceCommandArgv(
      command,
      options.openCliBin,
      options.timeoutMs,
      collectionCache,
      runJson,
    );

    tasks.push({
      taskKey: `${adapter.key}:${argv.join(" ")}`,
      source: command.source,
      capability: commandCategoryToCapability(command.category),
      commandName: command.name,
      argv,
      helpArgv: command.helpArgv,
      breakerKey: `${command.source}:${command.category}:${command.name}`,
      adapterKey: adapter.key,
      routeRole: "primary",
      taskFamily: command.name,
      metadata: undefined,
    });
  }

  return tasks;
}

function buildCollectTasks(
  options: CollectLiveSourcePayloadOptions,
  registry: SourceAdapterRegistry,
): SourceTask[] {
  const adapters = listSourceAdapters(registry, options.sources);
  const context = buildSourceTaskContext({
    mode: options.mode ?? "collect",
    runtimeTopics: options.runtimeTopics ?? [],
    topicSlugs: options.topicSlugs,
    entitySlugs: options.entitySlugs,
    entitySearchTerms: options.entitySearchTerms,
    queryBudget: options.queryBudget,
  });

  const candidateTasks = adapters.flatMap((adapter) => [
    ...adapter.buildStaticTasks(context),
    ...adapter.buildDynamicTasks(context),
  ]);

  return candidateTasks.filter((task) => {
    const primaryAdapter = getPrimaryAdapterForRoute(
      task.source,
      task.capability,
      registry,
      task.taskFamily,
    );
    return primaryAdapter.key === task.adapterKey;
  });
}

function buildFailedPayload(
  task: SourceTask,
  startedAt: string,
  finishedAt: string,
  errorText: string,
  executionDecision: SourceTaskExecutionDecision,
  helpOutput = "",
): CollectedSourcePayload {
  return {
    source: task.source,
    capability: task.capability,
    taskKey: task.taskKey,
    breakerKey: task.breakerKey,
    adapterKey: task.adapterKey,
    routeRole: task.routeRole,
    executionDecision,
    commandName: task.commandName,
    argv: task.argv,
    startedAt,
    finishedAt,
    latencyMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    status: "failed",
    errorText,
    helpOutput,
    payload: [],
    metadata: task.metadata,
  };
}

export async function collectLiveSourcePayloads(
  options: CollectLiveSourcePayloadOptions,
  runText: typeof runOpenCli = runOpenCli,
  runJson: JsonRunner = runOpenCliJson<Record<string, unknown>[]>,
): Promise<CollectedSourcePayload[]> {
  const mode = options.mode ?? "collect";
  const registry = options.adapterRegistry ?? defaultSourceAdapterRegistry;
  const breakerStore =
    mode === "audit"
      ? createNoopCircuitBreakerStore()
      : (options.breakerStore ?? createNoopCircuitBreakerStore());
  const results: CollectedSourcePayload[] = [];
  const tasks =
    mode === "audit"
      ? await buildAuditTasks(options, registry, runJson)
      : buildCollectTasks(options, registry);

  for (const task of tasks) {
    const startedAt = new Date().toISOString();

    if (mode !== "audit") {
      const allowed = await breakerStore.allowRequest(task.breakerKey);
      if (!allowed) {
        const finishedAt = new Date().toISOString();
        results.push(
          buildFailedPayload(
            task,
            startedAt,
            finishedAt,
            `Circuit breaker open for ${task.breakerKey}`,
            "skipped-open-circuit",
          ),
        );
        continue;
      }
    }

    try {
      const [helpResult, payloadResult] = await Promise.allSettled([
        runText(options.openCliBin, task.helpArgv, options.timeoutMs),
        runJson(options.openCliBin, task.argv, options.timeoutMs),
      ]);
      const finishedAt = new Date().toISOString();
      const latencyMs =
        new Date(finishedAt).getTime() - new Date(startedAt).getTime();

      if (payloadResult.status === "fulfilled") {
        if (mode !== "audit") {
          await breakerStore.recordSuccess(task.breakerKey);
        }

        const helpOutput =
          helpResult.status === "fulfilled" ? helpResult.value : "";
        const errorText =
          helpResult.status === "rejected" ? String(helpResult.reason) : null;

        results.push({
          source: task.source,
          capability: task.capability,
          taskKey: task.taskKey,
          breakerKey: task.breakerKey,
          adapterKey: task.adapterKey,
          routeRole: task.routeRole,
          executionDecision: "executed",
          commandName: task.commandName,
          argv: task.argv,
          startedAt,
          finishedAt,
          latencyMs,
          status: "success",
          errorText,
          helpOutput,
          payload: payloadResult.value,
          metadata: task.metadata,
        });
        continue;
      }

      if (mode !== "audit") {
        await breakerStore.recordFailure(task.breakerKey);
      }

      results.push(
        buildFailedPayload(
          task,
          startedAt,
          finishedAt,
          String(payloadResult.reason),
          "executed",
          helpResult.status === "fulfilled" ? helpResult.value : "",
        ),
      );
    } catch (error) {
      if (mode !== "audit") {
        await breakerStore.recordFailure(task.breakerKey);
      }

      const finishedAt = new Date().toISOString();
      results.push(
        buildFailedPayload(
          task,
          startedAt,
          finishedAt,
          error instanceof Error ? error.message : String(error),
          "executed",
        ),
      );
    }
  }

  return results;
}

export function normalizeCollectedPayloads(
  payloads: CollectedSourcePayload[],
  registry: SourceAdapterRegistry = defaultSourceAdapterRegistry,
) {
  return payloads.flatMap((payload) => {
    if (payload.status === "failed") {
      return [];
    }

    const definition = getSourceCommandDefinition(
      payload.source,
      payload.commandName,
    );
    const capability = definition
      ? commandCategoryToCapability(definition.category)
      : payload.capability;
    const adapter = getSourceAdapterByKey(payload.adapterKey, registry);

    return adapter.normalize(
      {
        source: payload.source,
        commandName: payload.commandName,
        capability,
        metadata: payload.metadata,
      },
      payload.payload,
    );
  });
}
