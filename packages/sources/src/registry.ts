import type { SourceKey } from "@devtrend/contracts";
import {
  devToAdapter,
  hackerNewsAdapter,
  ossInsightAdapter,
  stackOverflowAdapter,
} from "./adapters/index.js";
import type {
  SourceAdapter,
  SourceAdapterRegistry,
  SourceCapability,
  SourceRoutePolicy,
} from "./types.js";

function buildDefaultRoutePolicies(
  adapters: SourceAdapter[],
): SourceRoutePolicy[] {
  return adapters.flatMap((adapter) =>
    adapter.supports.map((capability) => ({
      source: adapter.source,
      capability,
      primaryAdapterKey: adapter.key,
      backupAdapterKeys: [],
    })),
  );
}

export function createSourceAdapterRegistry(
  adapters: SourceAdapter[],
  routePolicies: SourceRoutePolicy[] = buildDefaultRoutePolicies(adapters),
): SourceAdapterRegistry {
  return {
    adapters,
    routePolicies,
  };
}

export const defaultSourceAdapterRegistry = createSourceAdapterRegistry([
  stackOverflowAdapter,
  hackerNewsAdapter,
  devToAdapter,
  ossInsightAdapter,
]);

export function listSourceAdapters(
  registry: SourceAdapterRegistry = defaultSourceAdapterRegistry,
  sources?: SourceKey[],
): SourceAdapter[] {
  if (!sources) {
    return registry.adapters;
  }

  const allowed = new Set(sources);
  return registry.adapters.filter((adapter) => allowed.has(adapter.source));
}

export function getSourceAdapterByKey(
  adapterKey: string,
  registry: SourceAdapterRegistry = defaultSourceAdapterRegistry,
): SourceAdapter {
  const adapter = registry.adapters.find((entry) => entry.key === adapterKey);
  if (!adapter) {
    throw new Error(`Unknown source adapter: ${adapterKey}`);
  }

  return adapter;
}

export function getSourceAdapterForSource(
  source: SourceKey,
  registry: SourceAdapterRegistry = defaultSourceAdapterRegistry,
): SourceAdapter {
  const adapter = registry.adapters.find((entry) => entry.source === source);
  if (!adapter) {
    throw new Error(`No source adapter registered for ${source}`);
  }

  return adapter;
}

export function getPrimaryAdapterForRoute(
  source: SourceKey,
  capability: SourceCapability,
  registry: SourceAdapterRegistry = defaultSourceAdapterRegistry,
  taskFamily?: string,
): SourceAdapter {
  const policy =
    registry.routePolicies.find(
      (entry) =>
        entry.source === source &&
        entry.capability === capability &&
        (entry.taskFamily === undefined || entry.taskFamily === taskFamily),
    ) ??
    registry.routePolicies.find(
      (entry) => entry.source === source && entry.capability === capability,
    );

  if (!policy) {
    return getSourceAdapterForSource(source, registry);
  }

  return getSourceAdapterByKey(policy.primaryAdapterKey, registry);
}
