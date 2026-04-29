import type { SourceKey } from "../../contracts/src/index.js";

export interface SourceCommandDefinition {
  source: SourceKey;
  name: string;
  args: string[];
  helpArgv: string[];
  category: "feed" | "search" | "adoption";
  collectionTargetName?: string;
}

export const sourceCommands: SourceCommandDefinition[] = [
  {
    source: "stackoverflow",
    name: "hot",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "hot", "--help"],
    category: "feed",
  },
  {
    source: "stackoverflow",
    name: "unanswered",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "unanswered", "--help"],
    category: "feed",
  },
  {
    source: "stackoverflow",
    name: "bounties",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "bounties", "--help"],
    category: "feed",
  },
  {
    source: "stackoverflow",
    name: "search",
    args: ["mcp", "--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "search", "--help"],
    category: "search",
  },
  {
    source: "hackernews",
    name: "ask",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "ask", "--help"],
    category: "feed",
  },
  {
    source: "hackernews",
    name: "top",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "top", "--help"],
    category: "feed",
  },
  {
    source: "hackernews",
    name: "search",
    args: ["vector database", "--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "search", "--help"],
    category: "search",
  },
  {
    source: "devto",
    name: "top",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["devto", "top", "--help"],
    category: "feed",
  },
  {
    source: "devto",
    name: "tag",
    args: ["mcp", "--limit", "5", "-f", "json"],
    helpArgv: ["devto", "tag", "--help"],
    category: "search",
  },
  {
    source: "ossinsight",
    name: "trending",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "trending", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "collections",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collections", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "hot-collections",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "hot-collections", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "collection-repos",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collection-repos", "--help"],
    category: "adoption",
    collectionTargetName: "Web Framework",
  },
  {
    source: "ossinsight",
    name: "collection-issues",
    args: ["--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collection-issues", "--help"],
    category: "adoption",
    collectionTargetName: "Web Framework",
  },
  {
    source: "ossinsight",
    name: "stargazer-history",
    args: ["fastify/fastify", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "stargazer-history", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "issue-creator-history",
    args: ["langchain-ai/langchain", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "issue-creator-history", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "pr-creator-history",
    args: ["pgvector/pgvector", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "pr-creator-history", "--help"],
    category: "adoption",
  },
];
