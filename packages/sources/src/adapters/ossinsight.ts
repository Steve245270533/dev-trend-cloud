import type { NormalizedItem, SourceFeatures } from "@devtrend/contracts";
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
  composeUnifiedRawMeta,
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
    const sourceItemId = `${commandName}-${repoName}-${index}`;
    const summary = normalizeText(
      entry.language ?? entry.collection_name ?? entry.period ?? commandName,
      commandName,
    );
    const url = resolveOssInsightUrl(entry);
    const score = Number(entry.stars ?? entry.value ?? entry.count ?? 0);
    const sourceFeatures: SourceFeatures = {
      shared: {
        score,
        trendScore:
          typeof entry.rank_change === "number" ? entry.rank_change : score,
      },
      ossinsight: {
        starsGrowth:
          typeof entry.stars_growth === "number"
            ? entry.stars_growth
            : undefined,
        issueCreatorGrowth:
          typeof entry.issue_creator_growth === "number"
            ? entry.issue_creator_growth
            : undefined,
        prCreatorGrowth:
          typeof entry.pr_creator_growth === "number"
            ? entry.pr_creator_growth
            : undefined,
        collectionMembership:
          typeof entry.collection_name === "string"
            ? [entry.collection_name]
            : undefined,
      },
    };
    const unifiedMeta = composeUnifiedRawMeta({
      source: "ossinsight",
      sourceItemId,
      title: repoName,
      summary,
      url,
      bodyExcerpt:
        typeof entry.description === "string"
          ? entry.description.slice(0, 400)
          : undefined,
      sourceFeatures,
    });

    return baseItem("ossinsight", sourceItemId, {
      title: repoName,
      summary,
      url,
      collectedAt,
      ...resolvePublishedAt(
        collectedAt,
        entry.date,
        entry.timestamp,
        entry.created_at,
      ),
      score,
      contentType: commandName,
      rawMeta: { commandName, ...metadata, ...entry, ...unifiedMeta },
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
