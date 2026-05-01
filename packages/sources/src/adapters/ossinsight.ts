import type { NormalizedItem } from "@devtrend/contracts";
import {
  collectStaticSourceCommands,
  dynamicSourceCommandTemplates,
} from "../command-registry.js";
import type {
  RuntimeTopicDiscoveryContext,
  RuntimeTopicDiscoveryResult,
  SourceAdapter,
  SourceTask,
  SourceTaskBuildContext,
} from "../types.js";
import {
  buildRuntimeTopicCandidate,
  isCollectionAllowed,
} from "./runtime-topic-shared.js";
import {
  baseItem,
  createSourceTask,
  filterRuntimeTopics,
  normalizeText,
  normalizeUrl,
  querySourceLabel,
  resolvePublishedAt,
} from "./shared.js";

function resolveOssInsightUrl(entry: Record<string, unknown>): string {
  const directUrl = normalizeUrl(entry.url);
  if (directUrl) {
    return directUrl;
  }

  const repoUrl = normalizeUrl(entry.repo_url);
  if (repoUrl) {
    return repoUrl;
  }

  const htmlUrl = normalizeUrl(entry.html_url);
  if (htmlUrl) {
    return htmlUrl;
  }

  const repoName = normalizeText(
    entry.repo_name ?? entry.repo ?? entry.name,
    "",
  );
  if (repoName.includes("/")) {
    return `https://github.com/${repoName}`;
  }

  return "";
}

function normalizeOssInsight(
  entries: Record<string, unknown>[],
  commandName: string,
  metadata?: Record<string, unknown>,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    const repoName = normalizeText(
      entry.repo_name ?? entry.repo ?? entry.name,
      `OSS Insight item ${index + 1}`,
    );
    return baseItem("ossinsight", `${commandName}-${repoName}-${index}`, {
      title: repoName,
      summary: normalizeText(
        entry.language ?? entry.collection_name ?? entry.period ?? commandName,
        commandName,
      ),
      url: resolveOssInsightUrl(entry),
      collectedAt,
      ...resolvePublishedAt(
        collectedAt,
        entry.date,
        entry.timestamp,
        entry.created_at,
      ),
      score: Number(entry.stars ?? entry.value ?? entry.count ?? 0),
      contentType: commandName,
      rawMeta: { commandName, ...metadata, ...entry },
    });
  });
}

export const ossInsightAdapter: SourceAdapter = {
  key: "ossinsight-default",
  source: "ossinsight",
  supports: ["adoption", "topic-discovery"],
  buildStaticTasks(_context: SourceTaskBuildContext): SourceTask[] {
    return collectStaticSourceCommands
      .filter((command) => command.source === "ossinsight")
      .map((command) =>
        createSourceTask({
          source: command.source,
          capability: command.category,
          commandName: command.name,
          argv: [command.source, command.name, ...(command.args ?? [])],
          helpArgv: command.helpArgv,
          adapterKey: "ossinsight-default",
        }),
      );
  },
  buildDynamicTasks(context: SourceTaskBuildContext): SourceTask[] {
    const tasks: SourceTask[] = [];
    const topics = filterRuntimeTopics(
      context.runtimeTopics,
      context.topicSlugs,
      context.queryBudget,
    );
    const templates = dynamicSourceCommandTemplates.filter(
      (entry) => entry.source === "ossinsight",
    );
    let dynamicCount = 0;

    for (const topic of topics) {
      if (!topic.collectionId) {
        continue;
      }

      for (const template of templates) {
        if (dynamicCount >= context.queryBudget.maxDynamicCommandsPerSource) {
          return tasks;
        }

        tasks.push(
          createSourceTask({
            source: "ossinsight",
            capability: "adoption",
            commandName: template.name,
            argv: [
              "ossinsight",
              template.name,
              topic.collectionId,
              "--limit",
              "5",
              "-f",
              "json",
            ],
            helpArgv: template.helpArgv,
            adapterKey: "ossinsight-default",
            metadata: {
              topicSlug: topic.slug,
              query: topic.collectionId,
              querySource: querySourceLabel(topic),
              expansionReason: "collection-adoption",
              runtimeTopicSeedRunId: topic.runId,
            },
          }),
        );
        dynamicCount += 1;
      }
    }

    return tasks;
  },
  normalize(task, entries) {
    return normalizeOssInsight(entries, task.commandName, task.metadata);
  },
  async discoverRuntimeTopics(
    context: RuntimeTopicDiscoveryContext,
  ): Promise<RuntimeTopicDiscoveryResult> {
    const [hotResult, collectionsResult] = await Promise.allSettled([
      context.runJson(
        context.openCliBin,
        ["ossinsight", "hot-collections", "--limit", "100", "-f", "json"],
        context.timeoutMs,
      ),
      context.runJson(
        context.openCliBin,
        ["ossinsight", "collections", "--limit", "200", "-f", "json"],
        context.timeoutMs,
      ),
    ]);

    const candidates = [];
    let candidateCount = 0;

    if (hotResult.status === "fulfilled") {
      for (const entry of hotResult.value) {
        const name = typeof entry.name === "string" ? entry.name : "";
        if (!isCollectionAllowed(name)) {
          continue;
        }

        const candidate = buildRuntimeTopicCandidate("ossinsight-hot", name, {
          collectionId:
            typeof entry.id === "string" ? entry.id : String(entry.id ?? ""),
          score: Number(entry.rank_change ?? entry.current_rank ?? 0) + 100,
          metadata: {
            repoName:
              typeof entry.repo_name === "string" ? entry.repo_name : undefined,
          },
        });

        if (candidate) {
          candidates.push(candidate);
          candidateCount += 1;
        }
      }
    }

    if (collectionsResult.status === "fulfilled") {
      for (const entry of collectionsResult.value) {
        const name = typeof entry.name === "string" ? entry.name : "";
        if (!isCollectionAllowed(name)) {
          continue;
        }

        const candidate = buildRuntimeTopicCandidate(
          "ossinsight-collections",
          name,
          {
            collectionId:
              typeof entry.id === "string" ? entry.id : String(entry.id ?? ""),
          },
        );

        if (candidate) {
          candidates.push(candidate);
          candidateCount += 1;
        }
      }
    }

    const failedBoth =
      hotResult.status === "rejected" &&
      collectionsResult.status === "rejected";
    const errorText = failedBoth
      ? `${String(hotResult.reason)} | ${String(collectionsResult.reason)}`
      : hotResult.status === "rejected"
        ? String(hotResult.reason)
        : collectionsResult.status === "rejected"
          ? String(collectionsResult.reason)
          : null;

    return {
      candidates,
      sourceStatuses: [
        {
          source: "ossinsight",
          status:
            hotResult.status === "fulfilled" ||
            collectionsResult.status === "fulfilled"
              ? "success"
              : "failed",
          errorText,
          candidateCount,
        },
      ],
    };
  },
};
