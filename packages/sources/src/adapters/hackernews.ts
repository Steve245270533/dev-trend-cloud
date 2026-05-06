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
  baseItem,
  composeUnifiedRawMeta,
  createSourceTask,
  filterRuntimeTopics,
  isExplicitQuestionTitle,
  normalizeText,
  normalizeUrl,
  querySourceLabel,
  resolvePublishedAt,
  topicSearchTerms,
  uniqueStrings,
} from "./shared.js";

function inferHackerNewsQuestion(title: string): boolean {
  const normalizedTitle = title.trim();
  if (/^ask hn:/i.test(normalizedTitle)) {
    return true;
  }

  if (/^tell hn:/i.test(normalizedTitle)) {
    return isExplicitQuestionTitle(
      normalizedTitle.replace(/^tell hn:\s*/i, "").trim(),
    );
  }

  return isExplicitQuestionTitle(normalizedTitle);
}

function resolveHackerNewsSourceItemId(
  entry: Record<string, unknown>,
  commandName: string,
  index: number,
): string {
  if (typeof entry.id === "string" || typeof entry.id === "number") {
    return String(entry.id);
  }

  if (typeof entry.url === "string" && entry.url.trim().length > 0) {
    return entry.url.trim();
  }

  if (typeof entry.title === "string" && entry.title.trim().length > 0) {
    return `${commandName}:${entry.title.trim()}`;
  }

  return `${commandName}-${index}`;
}

function resolveHackerNewsUrl(entry: Record<string, unknown>): string {
  const directUrl = normalizeUrl(entry.url);
  if (directUrl) {
    return directUrl;
  }

  if (typeof entry.id === "string" || typeof entry.id === "number") {
    return `https://news.ycombinator.com/item?id=${String(entry.id)}`;
  }

  return "";
}

function resolveHackerNewsPostKind(
  title: string,
): NonNullable<SourceFeatures["hackernews"]>["postKind"] {
  if (/^ask hn:/i.test(title)) {
    return "ask";
  }
  if (/^show hn:/i.test(title)) {
    return "show";
  }
  if (/^poll:/i.test(title)) {
    return "poll";
  }
  if (/^job:/i.test(title)) {
    return "job";
  }
  return "story";
}

function normalizeHackerNews(
  entries: Record<string, unknown>[],
  commandName: string,
  metadata?: Record<string, unknown>,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    const title = normalizeText(entry.title, `Hacker News item ${index + 1}`);
    const summary = normalizeText(entry.author, "");
    const url = resolveHackerNewsUrl(entry);
    const sourceItemId = resolveHackerNewsSourceItemId(
      entry,
      commandName,
      index,
    );
    const score = Number(entry.score ?? 0);
    const commentCount = Number(entry.comments ?? 0);
    const sourceFeatures: SourceFeatures = {
      shared: {
        score,
        commentCount,
      },
      hackernews: {
        points: score,
        comments: commentCount,
        postKind: resolveHackerNewsPostKind(title),
      },
    };
    const unifiedMeta = composeUnifiedRawMeta({
      source: "hackernews",
      sourceItemId,
      title,
      summary,
      url,
      bodyExcerpt:
        typeof entry.text === "string" ? entry.text.slice(0, 400) : undefined,
      sourceFeatures,
    });

    return baseItem("hackernews", sourceItemId, {
      title,
      summary,
      url,
      collectedAt,
      ...resolvePublishedAt(
        collectedAt,
        entry.created_at,
        entry.createdAt,
        entry.time,
        entry.published_at,
        entry.date,
      ),
      score,
      commentCount,
      contentType: commandName,
      isQuestion: inferHackerNewsQuestion(title),
      rawMeta: { commandName, ...metadata, ...entry, ...unifiedMeta },
    });
  });
}

export const hackerNewsAdapter: SourceAdapter = {
  key: "hackernews-default",
  source: "hackernews",
  supports: ["feed", "search"],
  buildStaticTasks(_context: SourceTaskBuildContext): SourceTask[] {
    return collectStaticSourceCommands
      .filter((command) => command.source === "hackernews")
      .map((command) =>
        createSourceTask({
          source: command.source,
          capability: command.category,
          commandName: command.name,
          argv: [command.source, command.name, ...(command.args ?? [])],
          helpArgv: command.helpArgv,
          adapterKey: "hackernews-default",
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
    const template = dynamicSourceCommandTemplates.find(
      (entry) => entry.source === "hackernews" && entry.name === "search",
    );

    if (!template) {
      return tasks;
    }

    let dynamicCount = 0;
    for (const topic of topics) {
      const terms = topicSearchTerms(topic, "hackernews", context.queryBudget);

      for (const term of terms) {
        if (dynamicCount >= context.queryBudget.maxDynamicCommandsPerSource) {
          break;
        }

        tasks.push(
          createSourceTask({
            source: "hackernews",
            capability: "search",
            commandName: template.name,
            argv: ["hackernews", "search", term, "--limit", "5", "-f", "json"],
            helpArgv: template.helpArgv,
            adapterKey: "hackernews-default",
            metadata: {
              topicSlug: topic.slug,
              query: term,
              querySource: querySourceLabel(topic),
              expansionReason: "topic-search",
              runtimeTopicSeedRunId: topic.runId,
            },
          }),
        );
        dynamicCount += 1;
      }
    }

    const entityTerms = uniqueStrings([
      ...(context.entitySearchTerms ?? []),
      ...(context.entitySlugs ?? []),
    ]);

    for (const term of entityTerms) {
      if (dynamicCount >= context.queryBudget.maxDynamicCommandsPerSource) {
        break;
      }

      tasks.push(
        createSourceTask({
          source: "hackernews",
          capability: "search",
          commandName: "search",
          argv: ["hackernews", "search", term, "--limit", "5", "-f", "json"],
          helpArgv: ["hackernews", "search", "--help"],
          adapterKey: "hackernews-default",
          metadata: {
            query: term,
            querySource: "fallback-topics",
            expansionReason: "entity-search",
          },
        }),
      );
      dynamicCount += 1;
    }

    return tasks;
  },
  normalize(task, entries) {
    return normalizeHackerNews(entries, task.commandName, task.metadata);
  },
  async discoverRuntimeTopics(
    _context: RuntimeTopicDiscoveryContext,
  ): Promise<RuntimeTopicDiscoveryResult> {
    return {
      candidates: [],
      sourceStatuses: [],
    };
  },
};
