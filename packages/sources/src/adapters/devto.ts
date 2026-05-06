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
  dedupeStrings,
  isSafeRuntimeTag,
  normalizeKeyword,
} from "./runtime-topic-shared.js";
import {
  baseItem,
  composeUnifiedRawMeta,
  createSourceTask,
  filterRuntimeTopics,
  isExplicitQuestionTitle,
  normalizeTags,
  normalizeText,
  normalizeUrl,
  querySourceLabel,
  resolvePublishedAt,
  topicSearchTerms,
} from "./shared.js";

function resolveDevToUrl(entry: Record<string, unknown>): string {
  return normalizeUrl(entry.url);
}

function normalizeDevTo(
  entries: Record<string, unknown>[],
  commandName: string,
  metadata?: Record<string, unknown>,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    const title = normalizeText(entry.title, `DEV item ${index + 1}`);
    const summary = normalizeText(entry.author, "");
    const url = resolveDevToUrl(entry);
    const sourceItemId = String(
      entry.url ?? entry.title ?? `${commandName}-${index}`,
    );
    const score = Number(entry.reactions ?? 0);
    const commentCount = Number(entry.comments ?? 0);
    const tags = normalizeTags(entry.tags);
    const readingTimeMinutes =
      typeof entry.reading_time_minutes === "number" &&
      Number.isInteger(entry.reading_time_minutes) &&
      entry.reading_time_minutes >= 0
        ? entry.reading_time_minutes
        : undefined;
    const sourceFeatures: SourceFeatures = {
      shared: {
        score,
        reactionCount: score,
        commentCount,
      },
      devto: {
        readingTimeMinutes,
        reactionsCount: score,
        commentsCount: commentCount,
        tagDensity: tags.length / Math.max(1, title.split(/\s+/).length),
        tutorialIntent: /(^how to\b)|(\btutorial\b)|(\bguide\b)/i.test(title),
      },
    };
    const unifiedMeta = composeUnifiedRawMeta({
      source: "devto",
      sourceItemId,
      title,
      summary,
      url,
      bodyExcerpt:
        typeof entry.description === "string"
          ? entry.description.slice(0, 400)
          : undefined,
      sourceFeatures,
    });

    return baseItem("devto", sourceItemId, {
      title,
      summary,
      url,
      collectedAt,
      ...resolvePublishedAt(
        collectedAt,
        entry.published_at,
        entry.publishedAt,
        entry.created_at,
      ),
      score,
      commentCount,
      tags,
      contentType: commandName,
      isQuestion: isExplicitQuestionTitle(String(entry.title ?? "")),
      rawMeta: { commandName, ...metadata, ...entry, ...unifiedMeta },
    });
  });
}

export const devToAdapter: SourceAdapter = {
  key: "devto-default",
  source: "devto",
  supports: ["feed", "search", "topic-discovery"],
  buildStaticTasks(_context: SourceTaskBuildContext): SourceTask[] {
    return collectStaticSourceCommands
      .filter((command) => command.source === "devto")
      .map((command) =>
        createSourceTask({
          source: command.source,
          capability: command.category,
          commandName: command.name,
          argv: [command.source, command.name, ...(command.args ?? [])],
          helpArgv: command.helpArgv,
          adapterKey: "devto-default",
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
      (entry) => entry.source === "devto" && entry.name === "tag",
    );

    if (!template) {
      return tasks;
    }

    let dynamicCount = 0;
    for (const topic of topics) {
      const tags = topicSearchTerms(topic, "devto", context.queryBudget);

      for (const tag of tags) {
        if (dynamicCount >= context.queryBudget.maxDynamicCommandsPerSource) {
          break;
        }

        tasks.push(
          createSourceTask({
            source: "devto",
            capability: "search",
            commandName: template.name,
            argv: ["devto", "tag", tag, "--limit", "5", "-f", "json"],
            helpArgv: template.helpArgv,
            adapterKey: "devto-default",
            metadata: {
              topicSlug: topic.slug,
              query: tag,
              querySource: querySourceLabel(topic),
              expansionReason: "topic-tag",
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
    return normalizeDevTo(entries, task.commandName, task.metadata);
  },
  async discoverRuntimeTopics(
    context: RuntimeTopicDiscoveryContext,
  ): Promise<RuntimeTopicDiscoveryResult> {
    const result = await context.runJson(
      context.openCliBin,
      ["devto", "top", "--limit", "30", "-f", "json"],
      context.timeoutMs,
    );

    const tags = result.flatMap((entry) => {
      const raw = typeof entry.tags === "string" ? entry.tags : "";
      return raw
        .split(",")
        .map((tag) => normalizeKeyword(tag))
        .filter(isSafeRuntimeTag);
    });

    const candidates = dedupeStrings(tags).flatMap((tag, index) => {
      const candidate = buildRuntimeTopicCandidate("devto-top", tag, {
        devtoTags: [tag],
        score: 50 - index,
      });
      return candidate ? [candidate] : [];
    });

    return {
      candidates,
      sourceStatuses: [
        {
          source: "devto",
          status: "success",
          errorText: null,
          candidateCount: candidates.length,
        },
      ],
    };
  },
};
