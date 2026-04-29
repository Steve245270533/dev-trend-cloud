import type { SourceKey } from "@devtrend/contracts";
import {
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
  fallbackSourceRunId?: string;
  fallbackSnapshotId?: string;
  fallbackCollectedAt?: string;
}

interface CollectionIdentity {
  id: string;
  name: string;
}

type JsonRunner = (
  bin: string,
  argv: string[],
  timeoutMs: number,
) => Promise<Record<string, unknown>[]>;

function normalizeCollectionLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function buildStaticArgv(command: SourceCommandDefinition): string[] {
  return [command.source, command.name, ...command.args];
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

  return [command.source, command.name, collectionId, ...command.args];
}

export async function collectLiveSourcePayloads(
  openCliBin: string,
  timeoutMs: number,
  sources?: SourceKey[],
  runText: typeof runOpenCli = runOpenCli,
  runJson: JsonRunner = runOpenCliJson<Record<string, unknown>[]>,
): Promise<CollectedSourcePayload[]> {
  const results: CollectedSourcePayload[] = [];
  const collectionCache = new Map<string, string>();
  const commands =
    sources === undefined
      ? sourceCommands
      : sourceCommands.filter((command) => sources.includes(command.source));

  for (const command of commands) {
    const startedAt = new Date().toISOString();

    try {
      const argv = await resolveSourceCommandArgv(
        command,
        openCliBin,
        timeoutMs,
        collectionCache,
        runJson,
      );
      const [helpResult, payloadResult] = await Promise.allSettled([
        runText(openCliBin, command.helpArgv, timeoutMs),
        runJson(openCliBin, argv, timeoutMs),
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
          commandName: command.name,
          argv,
          startedAt,
          finishedAt,
          latencyMs,
          status: "success",
          errorText,
          helpOutput,
          payload: payloadResult.value,
        });
        continue;
      }

      results.push({
        source: command.source,
        commandName: command.name,
        argv,
        startedAt,
        finishedAt,
        latencyMs,
        status: "failed",
        errorText: String(payloadResult.reason),
        helpOutput: helpResult.status === "fulfilled" ? helpResult.value : "",
        payload: [],
      });
    } catch (error) {
      const finishedAt = new Date().toISOString();
      results.push({
        source: command.source,
        commandName: command.name,
        argv: buildStaticArgv(command),
        startedAt,
        finishedAt,
        latencyMs:
          new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        status: "failed",
        errorText: error instanceof Error ? error.message : String(error),
        helpOutput: "",
        payload: [],
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
    );
  });
}
