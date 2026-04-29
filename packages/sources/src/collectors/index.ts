import type { SourceKey } from "../../../contracts/src/index.js";
import { sourceCommands } from "../command-registry.js";
import { normalizeSourcePayload } from "../normalizers/index.js";
import { runOpenCli, runOpenCliJson } from "../opencli.js";

export interface CollectedSourcePayload {
  source: string;
  commandName: string;
  argv: string[];
  helpOutput: string;
  payload: Record<string, unknown>[];
}

export async function collectLiveSourcePayloads(
  openCliBin: string,
  timeoutMs: number,
  sources?: SourceKey[],
): Promise<CollectedSourcePayload[]> {
  const results: CollectedSourcePayload[] = [];
  const commands =
    sources === undefined
      ? sourceCommands
      : sourceCommands.filter((command) => sources.includes(command.source));

  for (const command of commands) {
    const [helpOutput, payload] = await Promise.all([
      runOpenCli(openCliBin, command.helpArgv, timeoutMs),
      runOpenCliJson<Record<string, unknown>[]>(
        openCliBin,
        command.argv,
        timeoutMs,
      ),
    ]);

    results.push({
      source: command.source,
      commandName: command.name,
      argv: command.argv,
      helpOutput,
      payload,
    });
  }

  return results;
}

export function normalizeCollectedPayloads(payloads: CollectedSourcePayload[]) {
  return payloads.flatMap((payload) =>
    normalizeSourcePayload(
      payload.source as never,
      payload.commandName,
      payload.payload,
    ),
  );
}
