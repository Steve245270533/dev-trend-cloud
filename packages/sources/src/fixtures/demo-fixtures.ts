import type { SourceKey } from "@devtrend/contracts";
import type { SourceCommandDefinition } from "../command-registry.js";
import { normalizeSourcePayload } from "../normalizers/index.js";

export const demoCommandPayloads: Record<string, Record<string, unknown>[]> = {
  "stackoverflow:hot": [
    {
      title:
        "How do I debug Model Context Protocol tool registration in Fastify?",
      score: 12,
      answers: 0,
      url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
    },
    {
      title:
        "Why is my BullMQ worker not processing jobs with Redis in Docker?",
      score: 8,
      answers: 1,
      url: "https://stackoverflow.com/questions/10000002/bullmq-redis-docker",
    },
  ],
  "stackoverflow:unanswered": [
    {
      title:
        "How do I cluster repeated LangChain agent errors without embeddings?",
      score: 16,
      answers: 0,
      url: "https://stackoverflow.com/questions/10000003/langchain-agent-clustering",
    },
    {
      title: "How do I make pgvector work with Postgres 16 in Docker?",
      score: 11,
      answers: 0,
      url: "https://stackoverflow.com/questions/10000004/pgvector-postgres16-docker",
    },
  ],
  "stackoverflow:bounties": [
    {
      title:
        "Why does vector similarity search return unstable results in pgvector?",
      score: 20,
      answers: 0,
      url: "https://stackoverflow.com/questions/10000005/pgvector-similarity",
    },
  ],
  "stackoverflow:search": [
    {
      title: "How to implement tool calling schema validation with MCP?",
      score: 6,
      answers: 1,
      url: "https://stackoverflow.com/questions/10000006/mcp-schema-validation",
    },
  ],
  "hackernews:ask": [
    {
      title: "Ask HN: Why do agent eval frameworks feel impossible to trust?",
      score: 44,
      author: "alice",
      comments: 32,
    },
    {
      title: "Ask HN: How are you debugging MCP tool calling failures?",
      score: 29,
      author: "bob",
      comments: 18,
    },
    {
      title: "Ask HN: How are you validating MCP tool calling schemas?",
      score: 23,
      author: "cory",
      comments: 16,
    },
  ],
  "hackernews:top": [
    {
      title: "Fastify v5 patterns for low-latency APIs",
      score: 71,
      author: "carol",
      comments: 21,
      url: "https://example.com/fastify-v5",
    },
    {
      title: "Vector databases vs Postgres for production RAG",
      score: 67,
      author: "dave",
      comments: 54,
      url: "https://example.com/vector-vs-postgres",
    },
  ],
  "hackernews:search": [
    {
      title: "How are teams evaluating long-running agent workflows?",
      score: 15,
      author: "erin",
      comments: 9,
      url: "https://example.com/agent-workflow-evals",
    },
    {
      title:
        "Why does pgvector similarity search keep returning unstable results?",
      score: 19,
      author: "fiona",
      comments: 13,
      url: "https://example.com/pgvector-similarity-results",
    },
  ],
  "devto:top": [
    {
      title: "Building a Fastify + BullMQ pipeline for developer signals",
      author: "frank",
      reactions: 48,
      comments: 7,
      tags: ["fastify", "typescript", "bullmq"],
      url: "https://dev.to/example/fastify-bullmq-pipeline",
      published_at: "2026-04-28T10:00:00.000Z",
    },
    {
      title: "Why pgvector is becoming the default RAG storage layer",
      author: "grace",
      reactions: 63,
      comments: 11,
      tags: ["postgres", "pgvector", "rag"],
      url: "https://dev.to/example/pgvector-rag",
      published_at: "2026-04-28T12:00:00.000Z",
    },
    {
      title:
        "Why is pgvector returning unstable similarity search results for RAG?",
      author: "gina",
      reactions: 28,
      comments: 6,
      tags: ["pgvector", "postgres", "rag"],
      url: "https://dev.to/example/pgvector-similarity-rag",
      published_at: "2026-04-28T14:30:00.000Z",
    },
  ],
  "devto:tag": [
    {
      title: "Model Context Protocol starter guide for tool calling",
      author: "henry",
      reactions: 32,
      comments: 4,
      tags: ["mcp", "ai", "developer-tools"],
      url: "https://dev.to/example/mcp-guide",
      published_at: "2026-04-28T08:00:00.000Z",
    },
    {
      title: "How are teams validating MCP tool calling schemas?",
      author: "ivy",
      reactions: 35,
      comments: 8,
      tags: ["mcp", "tool-calling", "typescript"],
      url: "https://dev.to/example/mcp-schema-validation",
      published_at: "2026-04-28T09:30:00.000Z",
    },
  ],
  "ossinsight:trending": [
    {
      repo_name: "fastify/fastify",
      language: "TypeScript",
      stars: 134,
    },
    {
      repo_name: "pgvector/pgvector",
      language: "C",
      stars: 88,
    },
  ],
  "ossinsight:collections": [
    {
      name: "web-frameworks",
      count: 120,
    },
    {
      name: "ai-agents",
      count: 64,
    },
  ],
  "ossinsight:hot-collections": [
    {
      name: "vector-databases",
      count: 18,
    },
  ],
  "ossinsight:collection-repos": [
    {
      repo_name: "fastify/fastify",
      language: "TypeScript",
      stars: 45,
    },
  ],
  "ossinsight:collection-issues": [
    {
      repo_name: "langchain-ai/langchain",
      count: 37,
    },
  ],
  "ossinsight:stargazer-history": [
    {
      repo_name: "fastify/fastify",
      date: "2026-04-28T00:00:00.000Z",
      value: 25,
    },
  ],
  "ossinsight:issue-creator-history": [
    {
      repo_name: "langchain-ai/langchain",
      date: "2026-04-28T00:00:00.000Z",
      value: 17,
    },
  ],
  "ossinsight:pr-creator-history": [
    {
      repo_name: "pgvector/pgvector",
      date: "2026-04-28T00:00:00.000Z",
      value: 9,
    },
  ],
};

export function normalizedDemoItems(definitions: SourceCommandDefinition[]) {
  return definitions.flatMap((definition) => {
    const key = `${definition.source}:${definition.name}`;
    const entries = demoCommandPayloads[key] ?? [];
    return normalizeSourcePayload(
      definition.source as SourceKey,
      definition.name,
      entries,
    );
  });
}
