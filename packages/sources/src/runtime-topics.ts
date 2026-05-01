import {
  mergeRuntimeTopicCandidates,
  normalizeRuntimeTopicCandidates,
} from "./adapters/index.js";
import { createNoopCircuitBreakerStore } from "./breakers.js";
import { runOpenCliJson } from "./opencli.js";
import {
  defaultSourceAdapterRegistry,
  listSourceAdapters,
} from "./registry.js";
import type {
  CircuitBreakerStore,
  JsonRunner,
  RuntimeTopicDiscoveryResult,
  RuntimeTopicDiscoverySourceStatus,
  SourceAdapterRegistry,
} from "./types.js";

export type {
  RuntimeTopicCandidate,
  RuntimeTopicDiscoveryResult,
  RuntimeTopicDiscoverySourceStatus,
} from "./types.js";

function isDiscoverySourceStatus(
  status: RuntimeTopicDiscoverySourceStatus,
): boolean {
  return status.source === "ossinsight" || status.source === "devto";
}

export async function discoverRuntimeTopicCandidates(
  openCliBin: string,
  timeoutMs: number,
  runJson: JsonRunner = runOpenCliJson<Record<string, unknown>[]>,
  registry: SourceAdapterRegistry = defaultSourceAdapterRegistry,
  breakerStore: CircuitBreakerStore = createNoopCircuitBreakerStore(),
): Promise<RuntimeTopicDiscoveryResult> {
  const adapters = listSourceAdapters(registry).filter(
    (adapter) =>
      adapter.supports.includes("topic-discovery") &&
      typeof adapter.discoverRuntimeTopics === "function",
  );
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      const breakerKey = `${adapter.source}:topic-discovery:discovery`;
      const allowed = await breakerStore.allowRequest(breakerKey);

      if (!allowed) {
        return {
          candidates: [],
          sourceStatuses: [
            {
              source: adapter.source as "ossinsight" | "devto",
              status: "failed",
              errorText: `Circuit breaker open for ${breakerKey}`,
              candidateCount: 0,
            },
          ],
        } satisfies RuntimeTopicDiscoveryResult;
      }

      try {
        const result = await adapter.discoverRuntimeTopics?.({
          openCliBin,
          timeoutMs,
          runJson,
        });

        if (!result) {
          await breakerStore.recordSuccess(breakerKey);
          return {
            candidates: [],
            sourceStatuses: [],
          } satisfies RuntimeTopicDiscoveryResult;
        }

        const hasSuccess = result.sourceStatuses.some(
          (status) => status.status === "success",
        );

        if (hasSuccess) {
          await breakerStore.recordSuccess(breakerKey);
        } else {
          await breakerStore.recordFailure(breakerKey);
        }

        return result;
      } catch (error) {
        await breakerStore.recordFailure(breakerKey);
        return {
          candidates: [],
          sourceStatuses: [
            {
              source: adapter.source as "ossinsight" | "devto",
              status: "failed",
              errorText: error instanceof Error ? error.message : String(error),
              candidateCount: 0,
            },
          ],
        } satisfies RuntimeTopicDiscoveryResult;
      }
    }),
  );

  return {
    candidates: results.flatMap((result) => result.candidates),
    sourceStatuses: results
      .flatMap((result) => result.sourceStatuses)
      .filter(isDiscoverySourceStatus),
  };
}

export { mergeRuntimeTopicCandidates, normalizeRuntimeTopicCandidates };
