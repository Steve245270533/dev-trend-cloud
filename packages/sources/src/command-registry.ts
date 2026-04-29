import type { SourceKey } from "../../contracts/src/index.js";

export interface SourceCommandDefinition {
  source: SourceKey;
  name: string;
  argv: string[];
  helpArgv: string[];
  category: "feed" | "search" | "adoption";
}

export const sourceCommands: SourceCommandDefinition[] = [
  {
    source: "stackoverflow",
    name: "hot",
    argv: ["stackoverflow", "hot", "--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "hot", "--help"],
    category: "feed",
  },
  {
    source: "stackoverflow",
    name: "unanswered",
    argv: ["stackoverflow", "unanswered", "--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "unanswered", "--help"],
    category: "feed",
  },
  {
    source: "stackoverflow",
    name: "bounties",
    argv: ["stackoverflow", "bounties", "--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "bounties", "--help"],
    category: "feed",
  },
  {
    source: "stackoverflow",
    name: "search",
    argv: ["stackoverflow", "search", "mcp", "--limit", "5", "-f", "json"],
    helpArgv: ["stackoverflow", "search", "--help"],
    category: "search",
  },
  {
    source: "hackernews",
    name: "ask",
    argv: ["hackernews", "ask", "--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "ask", "--help"],
    category: "feed",
  },
  {
    source: "hackernews",
    name: "top",
    argv: ["hackernews", "top", "--limit", "5", "-f", "json"],
    helpArgv: ["hackernews", "top", "--help"],
    category: "feed",
  },
  {
    source: "hackernews",
    name: "search",
    argv: [
      "hackernews",
      "search",
      "vector database",
      "--limit",
      "5",
      "-f",
      "json",
    ],
    helpArgv: ["hackernews", "search", "--help"],
    category: "search",
  },
  {
    source: "devto",
    name: "top",
    argv: ["devto", "top", "--limit", "5", "-f", "json"],
    helpArgv: ["devto", "top", "--help"],
    category: "feed",
  },
  {
    source: "devto",
    name: "tag",
    argv: ["devto", "tag", "mcp", "--limit", "5", "-f", "json"],
    helpArgv: ["devto", "tag", "--help"],
    category: "search",
  },
  {
    source: "ossinsight",
    name: "trending",
    argv: ["ossinsight", "trending", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "trending", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "collections",
    argv: ["ossinsight", "collections", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "collections", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "hot-collections",
    argv: ["ossinsight", "hot-collections", "--limit", "5", "-f", "json"],
    helpArgv: ["ossinsight", "hot-collections", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "collection-repos",
    argv: [
      "ossinsight",
      "collection-repos",
      "web-frameworks",
      "--limit",
      "5",
      "-f",
      "json",
    ],
    helpArgv: ["ossinsight", "collection-repos", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "collection-issues",
    argv: [
      "ossinsight",
      "collection-issues",
      "web-frameworks",
      "--limit",
      "5",
      "-f",
      "json",
    ],
    helpArgv: ["ossinsight", "collection-issues", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "stargazer-history",
    argv: [
      "ossinsight",
      "stargazer-history",
      "fastify/fastify",
      "--limit",
      "5",
      "-f",
      "json",
    ],
    helpArgv: ["ossinsight", "stargazer-history", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "issue-creator-history",
    argv: [
      "ossinsight",
      "issue-creator-history",
      "langchain-ai/langchain",
      "--limit",
      "5",
      "-f",
      "json",
    ],
    helpArgv: ["ossinsight", "issue-creator-history", "--help"],
    category: "adoption",
  },
  {
    source: "ossinsight",
    name: "pr-creator-history",
    argv: [
      "ossinsight",
      "pr-creator-history",
      "pgvector/pgvector",
      "--limit",
      "5",
      "-f",
      "json",
    ],
    helpArgv: ["ossinsight", "pr-creator-history", "--help"],
    category: "adoption",
  },
];
