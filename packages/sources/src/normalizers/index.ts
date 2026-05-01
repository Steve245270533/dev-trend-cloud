import type { SourceKey } from "@devtrend/contracts";
import {
  commandCategoryToCapability,
  getSourceCommandDefinition,
} from "../command-registry.js";
import {
  defaultSourceAdapterRegistry,
  getPrimaryAdapterForRoute,
} from "../registry.js";
import type { SourceAdapterRegistry } from "../types.js";

export function normalizeSourcePayload(
  source: SourceKey,
  commandName: string,
  entries: Record<string, unknown>[],
  registry: SourceAdapterRegistry = defaultSourceAdapterRegistry,
) {
  const definition = getSourceCommandDefinition(source, commandName);
  const capability = definition
    ? commandCategoryToCapability(definition.category)
    : "feed";
  const adapter = getPrimaryAdapterForRoute(
    source,
    capability,
    registry,
    commandName,
  );

  return adapter.normalize(
    {
      source,
      commandName,
      capability,
      metadata: undefined,
    },
    entries,
  );
}
