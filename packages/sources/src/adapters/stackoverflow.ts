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
  normalizeTags,
  normalizeText,
  normalizeUrl,
  querySourceLabel,
  resolvePublishedAt,
  topicSearchTerms,
  uniqueStrings,
} from "./shared.js";

function pickOptionalInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function resolveStackOverflowSourceFeatures(
  entry: Record<string, unknown>,
  score: number,
  answerCount: number,
  commentCount: number,
): SourceFeatures {
  const viewCount =
    pickOptionalInteger(entry.view_count) ??
    pickOptionalInteger(entry.viewCount) ??
    pickOptionalInteger(entry.views);
  const hasAcceptedAnswer =
    typeof entry.is_answered === "boolean"
      ? entry.is_answered
      : entry.accepted_answer_id !== undefined
        ? true
        : undefined;

  return {
    shared: {
      score,
      answerCount,
      commentCount,
      viewCount,
    },
    stackoverflow: {
      answerCount,
      commentCount,
      viewCount,
      hasAcceptedAnswer,
    },
  };
}

function resolveStackOverflowUrl(entry: Record<string, unknown>): string {
  const directUrl = normalizeUrl(entry.url);
  if (directUrl) {
    return directUrl;
  }

  if (
    typeof entry.question_id === "string" ||
    typeof entry.question_id === "number"
  ) {
    return `https://stackoverflow.com/questions/${String(entry.question_id)}`;
  }

  if (typeof entry.id === "string" || typeof entry.id === "number") {
    return `https://stackoverflow.com/questions/${String(entry.id)}`;
  }

  return "";
}

function normalizeStackOverflow(
  entries: Record<string, unknown>[],
  commandName: string,
  metadata?: Record<string, unknown>,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    const title = normalizeText(
      entry.title,
      `Stack Overflow item ${index + 1}`,
    );
    const summary = normalizeText(entry.title, "");
    const url = resolveStackOverflowUrl(entry);
    const answerCount = Number(entry.answers ?? 0);
    const commentCount = Number(entry.comments ?? 0);
    const score = Number(entry.score ?? 0);
    const sourceItemId = String(entry.url ?? `${commandName}-${index}`);
    const sourceFeatures = resolveStackOverflowSourceFeatures(
      entry,
      score,
      answerCount,
      commentCount,
    );
    const unifiedMeta = composeUnifiedRawMeta({
      source: "stackoverflow",
      sourceItemId,
      title,
      summary,
      url,
      bodyExcerpt:
        typeof entry.body_markdown === "string"
          ? entry.body_markdown.slice(0, 400)
          : undefined,
      sourceFeatures,
    });

    return baseItem("stackoverflow", sourceItemId, {
      title,
      summary,
      url,
      collectedAt,
      ...resolvePublishedAt(
        collectedAt,
        entry.creation_date,
        entry.creationDate,
        entry.created_at,
        entry.published_at,
        entry.last_activity_date,
        entry.date,
      ),
      score,
      answerCount,
      commentCount,
      tags: normalizeTags(entry.tags),
      contentType: commandName === "bounties" ? "bounty" : commandName,
      isQuestion: true,
      rawMeta: { commandName, ...metadata, ...entry, ...unifiedMeta },
    });
  });
}

export const stackOverflowAdapter: SourceAdapter = {
  key: "stackoverflow-default",
  source: "stackoverflow",
  supports: ["feed", "search"],
  buildStaticTasks(_context: SourceTaskBuildContext): SourceTask[] {
    return collectStaticSourceCommands
      .filter((command) => command.source === "stackoverflow")
      .map((command) =>
        createSourceTask({
          source: command.source,
          capability: command.category,
          commandName: command.name,
          argv: [command.source, command.name, ...(command.args ?? [])],
          helpArgv: command.helpArgv,
          adapterKey: "stackoverflow-default",
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
      (entry) => entry.source === "stackoverflow" && entry.name === "search",
    );

    if (!template) {
      return tasks;
    }

    let dynamicCount = 0;
    for (const topic of topics) {
      const terms = topicSearchTerms(
        topic,
        "stackoverflow",
        context.queryBudget,
      );

      for (const term of terms) {
        if (dynamicCount >= context.queryBudget.maxDynamicCommandsPerSource) {
          break;
        }

        tasks.push(
          createSourceTask({
            source: "stackoverflow",
            capability: "search",
            commandName: template.name,
            argv: [
              "stackoverflow",
              "search",
              term,
              "--limit",
              "5",
              "-f",
              "json",
            ],
            helpArgv: template.helpArgv,
            adapterKey: "stackoverflow-default",
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
          source: "stackoverflow",
          capability: "search",
          commandName: "search",
          argv: ["stackoverflow", "search", term, "--limit", "5", "-f", "json"],
          helpArgv: ["stackoverflow", "search", "--help"],
          adapterKey: "stackoverflow-default",
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
    return normalizeStackOverflow(entries, task.commandName, task.metadata);
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
