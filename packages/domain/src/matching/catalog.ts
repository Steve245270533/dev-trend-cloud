import { createHash } from "node:crypto";

export interface TopicSeed {
  id: string;
  slug: string;
  name: string;
  keywords: string[];
  repoPatterns: string[];
}

export interface EntitySeed {
  id: string;
  slug: string;
  name: string;
  entityType: "project" | "tool" | "framework" | "database" | "protocol";
  aliases: string[];
  repos: string[];
}

export interface WatchlistSeed {
  id: string;
  slug: string;
  name: string;
  description: string;
  rules: {
    topics: string[];
    entities: string[];
    sources: string[];
    minConfidence: number;
  };
}

function stableSeedId(scope: string, slug: string): string {
  const hex = createHash("sha1").update(`${scope}:${slug}`).digest("hex");
  const chars = hex.slice(0, 32).split("");

  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8).toString(
    16,
  );

  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

function topic(
  slug: string,
  name: string,
  keywords: string[],
  repoPatterns: string[] = [],
): TopicSeed {
  return {
    id: stableSeedId("topic", slug),
    slug,
    name,
    keywords,
    repoPatterns,
  };
}

function entity(
  slug: string,
  name: string,
  entityType: EntitySeed["entityType"],
  aliases: string[],
  repos: string[],
): EntitySeed {
  return {
    id: stableSeedId("entity", slug),
    slug,
    name,
    entityType,
    aliases,
    repos,
  };
}

export const topicSeeds: TopicSeed[] = [
  topic("ai-agents", "AI Agents", [
    "agent",
    "agents",
    "agentic",
    "multi-agent",
  ]),
  topic("agent-evals", "Agent Evals", [
    "eval",
    "evaluation",
    "benchmark",
    "grading",
  ]),
  topic("tool-calling", "Tool Calling", [
    "tool calling",
    "function calling",
    "tools",
  ]),
  topic("mcp", "Model Context Protocol", ["mcp", "model context protocol"]),
  topic("vector-databases", "Vector Databases", [
    "vector db",
    "vector database",
    "embedding store",
  ]),
  topic("rag", "Retrieval Augmented Generation", [
    "rag",
    "retrieval",
    "retriever",
  ]),
  topic("observability", "Observability", [
    "observability",
    "tracing",
    "telemetry",
  ]),
  topic("inference", "Inference", ["inference", "serving", "latency"]),
  topic("orchestration", "Orchestration", [
    "orchestration",
    "workflow",
    "scheduler",
  ]),
  topic("developer-tooling", "Developer Tooling", [
    "sdk",
    "cli",
    "developer tools",
  ]),
  topic("llm-frameworks", "LLM Frameworks", [
    "langchain",
    "llamaindex",
    "semantic kernel",
  ]),
  topic("api-design", "API Design", ["fastify", "rest", "api"]),
  topic("postgres", "Postgres", ["postgres", "pgvector", "sql"]),
  topic("redis", "Redis", ["redis", "bullmq", "queue"]),
  topic("typescript", "TypeScript", ["typescript", "ts", "swc"]),
  topic("prompt-engineering", "Prompt Engineering", ["prompt", "prompting"]),
  topic("docs-quality", "Docs Quality", ["docs", "documentation", "guide"]),
  topic("competitive-watch", "Competitive Watch", [
    "competitor",
    "alternative",
    "versus",
  ]),
  topic("oss-adoption", "OSS Adoption", [
    "stars",
    "issues",
    "pull requests",
    "adoption",
  ]),
  topic("evaluation-infra", "Evaluation Infrastructure", [
    "judge",
    "rubric",
    "dataset",
  ]),
];

export const entitySeeds: EntitySeed[] = [
  entity(
    "langchain",
    "LangChain",
    "framework",
    ["langchain"],
    ["langchain-ai/langchain"],
  ),
  entity(
    "llamaindex",
    "LlamaIndex",
    "framework",
    ["llamaindex"],
    ["run-llama/llama_index"],
  ),
  entity(
    "openai-agents-sdk",
    "OpenAI Agents SDK",
    "framework",
    ["openai agents sdk", "agents sdk"],
    ["openai/openai-agents-python"],
  ),
  entity(
    "mcp-protocol",
    "Model Context Protocol",
    "protocol",
    ["mcp", "model context protocol"],
    ["modelcontextprotocol/specification"],
  ),
  entity("mastra", "Mastra", "framework", ["mastra"], ["mastra-ai/mastra"]),
  entity("autogen", "AutoGen", "framework", ["autogen"], ["microsoft/autogen"]),
  entity(
    "crew-ai",
    "CrewAI",
    "framework",
    ["crewai", "crew ai"],
    ["crewAIInc/crewAI"],
  ),
  entity(
    "langgraph",
    "LangGraph",
    "framework",
    ["langgraph"],
    ["langchain-ai/langgraph"],
  ),
  entity(
    "pgvector",
    "pgvector",
    "database",
    ["pgvector"],
    ["pgvector/pgvector"],
  ),
  entity("qdrant", "Qdrant", "database", ["qdrant"], ["qdrant/qdrant"]),
  entity(
    "weaviate",
    "Weaviate",
    "database",
    ["weaviate"],
    ["weaviate/weaviate"],
  ),
  entity("pinecone", "Pinecone", "database", ["pinecone"], []),
  entity(
    "chroma",
    "Chroma",
    "database",
    ["chroma", "chromadb"],
    ["chroma-core/chroma"],
  ),
  entity("bullmq", "BullMQ", "tool", ["bullmq"], ["taskforcesh/bullmq"]),
  entity("fastify", "Fastify", "framework", ["fastify"], ["fastify/fastify"]),
  entity("swc", "SWC", "tool", ["swc"], ["swc-project/swc"]),
  entity("redis", "Redis", "database", ["redis"], ["redis/redis"]),
  entity(
    "postgresql",
    "PostgreSQL",
    "database",
    ["postgres", "postgresql"],
    ["postgres/postgres"],
  ),
  entity("openai", "OpenAI", "tool", ["openai"], ["openai/openai-node"]),
  entity("anthropic", "Anthropic", "tool", ["anthropic", "claude"], []),
];

export const watchlistSeeds: WatchlistSeed[] = [
  {
    id: stableSeedId("watchlist", "ai-agent-evals"),
    slug: "ai-agent-evals",
    name: "AI agent evals",
    description:
      "Track repeated developer friction around agent evaluation loops.",
    rules: {
      topics: ["agent-evals", "ai-agents", "evaluation-infra"],
      entities: ["langsmith", "langchain", "openai-agents-sdk"],
      sources: ["stackoverflow", "hackernews", "devto", "ossinsight"],
      minConfidence: 0.35,
    },
  },
  {
    id: stableSeedId("watchlist", "mcp-tool-calling"),
    slug: "mcp-tool-calling",
    name: "MCP / tool calling",
    description:
      "Track questions and adoption signals around tool calling infrastructure.",
    rules: {
      topics: ["mcp", "tool-calling", "developer-tooling"],
      entities: ["mcp-protocol", "fastify", "bullmq"],
      sources: ["stackoverflow", "hackernews", "devto", "ossinsight"],
      minConfidence: 0.35,
    },
  },
  {
    id: stableSeedId("watchlist", "vector-database-adoption"),
    slug: "vector-database-adoption",
    name: "Vector database adoption",
    description:
      "Track developer pain and open-source adoption for vector infrastructure.",
    rules: {
      topics: ["vector-databases", "rag", "oss-adoption"],
      entities: ["pgvector", "qdrant", "weaviate", "chroma"],
      sources: ["stackoverflow", "hackernews", "devto", "ossinsight"],
      minConfidence: 0.35,
    },
  },
];
