import type { SourceKey } from "@devtrend/contracts";
import type { SourceCapability } from "./types.js";

export interface SourceCommandDefinition {
  source: SourceKey;
  name: string;
  args?: string[];
  helpArgv: string[];
  category: "feed" | "search" | "adoption";
  mode?: "static" | "dynamic";
  collectionTargetName?: string;
}

export interface DynamicSourceCommandTemplate {
  source: SourceKey;
  name: string;
  category: "search" | "adoption";
  expansion:
    | "topic-search"
    | "topic-tag"
    | "collection-adoption"
    | "entity-search";
  helpArgv: string[];
}

export const sourceCommands: SourceCommandDefinition[] = [
  {
    source: "stackoverflow",
    name: "hot",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "hot", "--help"],
    category: "feed",
    mode: "static",
  },
  {
    source: "stackoverflow",
    name: "unanswered",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "unanswered", "--help"],
    category: "feed",
    mode: "static",
  },
  {
    source: "stackoverflow",
    name: "bounties",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "bounties", "--help"],
    category: "feed",
    mode: "static",
  },
  {
    source: "stackoverflow",
    name: "search",
    args: ["mcp", "--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "search", "--help"],
    category: "search",
    mode: "dynamic",
  },
  {
    source: "hackernews",
    name: "ask",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "ask", "--help"],
    category: "feed",
    mode: "static",
  },
  {
    source: "hackernews",
    name: "top",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "top", "--help"],
    category: "feed",
    mode: "static",
  },
  {
    source: "hackernews",
    name: "search",
    args: ["ask hn mcp", "--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "search", "--help"],
    category: "search",
    mode: "dynamic",
  },
  {
    source: "devto",
    name: "top",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["devto", "top", "--help"],
    category: "feed",
    mode: "static",
  },
  {
    source: "devto",
    name: "tag",
    args: ["mcp", "--limit", "5", "-f", "json"],
    helpArgv: ["devto", "tag", "--help"],
    category: "search",
    mode: "dynamic",
  },
  {
    source: "ossinsight",
    name: "trending",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "trending", "--help"],
    category: "adoption",
    mode: "static",
  },
  {
    source: "ossinsight",
    name: "collections",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collections", "--help"],
    category: "adoption",
    mode: "static",
  },
  {
    source: "ossinsight",
    name: "hot-collections",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "hot-collections", "--help"],
    category: "adoption",
    mode: "static",
  },
  {
    source: "ossinsight",
    name: "collection-repos",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collection-repos", "--help"],
    category: "adoption",
    mode: "dynamic",
    collectionTargetName: "Web Framework",
  },
  {
    source: "ossinsight",
    name: "collection-issues",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collection-issues", "--help"],
    category: "adoption",
    mode: "dynamic",
    collectionTargetName: "Web Framework",
  },
  {
    source: "ossinsight",
    name: "collection-prs",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collection-prs", "--help"],
    category: "adoption",
    mode: "dynamic",
    collectionTargetName: "Web Framework",
  },
  {
    source: "ossinsight",
    name: "collection-stars",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collection-stars", "--help"],
    category: "adoption",
    mode: "dynamic",
    collectionTargetName: "Web Framework",
  },
  {
    source: "ossinsight",
    name: "stargazer-history",
    args: ["fastify/fastify", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "stargazer-history", "--help"],
    category: "adoption",
    mode: "static",
  },
  {
    source: "ossinsight",
    name: "issue-creator-history",
    args: ["langchain-ai/langchain", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "issue-creator-history", "--help"],
    category: "adoption",
    mode: "static",
  },
  {
    source: "ossinsight",
    name: "pr-creator-history",
    args: ["pgvector/pgvector", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "pr-creator-history", "--help"],
    category: "adoption",
    mode: "static",
  },
];

export const collectStaticSourceCommands = sourceCommands.filter(
  (command) => command.mode !== "dynamic",
);

export const dynamicSourceCommandTemplates: DynamicSourceCommandTemplate[] = [
  {
    source: "stackoverflow",
    name: "search",
    category: "search",
    expansion: "topic-search",
    helpArgv: ["stackoverflow", "search", "--help"],
  },
  {
    source: "hackernews",
    name: "search",
    category: "search",
    expansion: "topic-search",
    helpArgv: ["hackernews", "search", "--help"],
  },
  {
    source: "devto",
    name: "tag",
    category: "search",
    expansion: "topic-tag",
    helpArgv: ["devto", "tag", "--help"],
  },
  {
    source: "ossinsight",
    name: "collection-repos",
    category: "adoption",
    expansion: "collection-adoption",
    helpArgv: ["ossinsight", "collection-repos", "--help"],
  },
  {
    source: "ossinsight",
    name: "collection-issues",
    category: "adoption",
    expansion: "collection-adoption",
    helpArgv: ["ossinsight", "collection-issues", "--help"],
  },
  {
    source: "ossinsight",
    name: "collection-prs",
    category: "adoption",
    expansion: "collection-adoption",
    helpArgv: ["ossinsight", "collection-prs", "--help"],
  },
  {
    source: "ossinsight",
    name: "collection-stars",
    category: "adoption",
    expansion: "collection-adoption",
    helpArgv: ["ossinsight", "collection-stars", "--help"],
  },
];

export function getSourceCommandDefinition(
  source: SourceKey,
  commandName: string,
): SourceCommandDefinition | undefined {
  return sourceCommands.find(
    (command) => command.source === source && command.name === commandName,
  );
}

export function commandCategoryToCapability(
  category: SourceCommandDefinition["category"],
): SourceCapability {
  return category;
}
