import type {
  TopicCluster,
  TopicNamingFallbackReason,
  TopicNamingStatus,
  TopicNode,
} from "@devtrend/contracts";

export interface TopicNamingCandidate {
  status: TopicNamingStatus;
  label: string;
  summary: string;
  keywords: string[];
  taxonomyL1: string;
  taxonomyL2?: string;
  taxonomyL3?: string;
  fallbackReason?: TopicNamingFallbackReason;
  provider?: string;
  model?: string;
  metadata: Record<string, unknown>;
}

export interface TopicNamingLLMResponse {
  label?: string;
  summary?: string;
  keywords?: string[];
  taxonomy?: {
    l1?: string;
    l2?: string;
    l3?: string;
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function toTitleCase(value: string): string {
  return normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeKeywords(keywords: string[], fallback: string[]): string[] {
  const values = [...keywords, ...fallback]
    .map(normalizeToken)
    .filter((value) => value.length >= 2 && value.length <= 48);
  return [...new Set(values)].slice(0, 10);
}

function parseJsonPayload(value: string): TopicNamingLLMResponse | null {
  const cleaned = value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  if (!cleaned.startsWith("{")) {
    return null;
  }
  try {
    return JSON.parse(cleaned) as TopicNamingLLMResponse;
  } catch {
    return null;
  }
}

export function parseTopicNamingLLMOutput(
  payload: unknown,
): TopicNamingLLMResponse | null {
  if (typeof payload === "string") {
    return parseJsonPayload(payload);
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.response === "string") {
    const parsed = parseJsonPayload(record.response);
    if (parsed) {
      return parsed;
    }
  }

  if (typeof record.content === "string") {
    const parsed = parseJsonPayload(record.content);
    if (parsed) {
      return parsed;
    }
  }

  if (typeof record.label === "string") {
    return record as TopicNamingLLMResponse;
  }

  if (
    typeof record.result === "object" &&
    record.result !== null &&
    "response" in (record.result as Record<string, unknown>)
  ) {
    const result = record.result as Record<string, unknown>;
    if (typeof result.response === "string") {
      return parseJsonPayload(result.response);
    }
  }

  return null;
}

function taxonomyFallback(cluster: TopicCluster): {
  taxonomyL1: string;
  taxonomyL2?: string;
  taxonomyL3?: string;
} {
  const signals = [
    cluster.slug,
    cluster.displayName,
    ...cluster.keywords,
    ...cluster.relatedEntities,
    ...cluster.relatedRepos,
  ]
    .join(" ")
    .toLowerCase();

  if (
    signals.includes("mcp") ||
    signals.includes("tool calling") ||
    signals.includes("agent")
  ) {
    return {
      taxonomyL1: "AI Engineering",
      taxonomyL2: "LLM Tooling",
      taxonomyL3: "MCP",
    };
  }

  if (
    signals.includes("pgvector") ||
    signals.includes("vector") ||
    signals.includes("rag") ||
    signals.includes("postgres")
  ) {
    return {
      taxonomyL1: "Data Infrastructure",
      taxonomyL2: "Databases",
      taxonomyL3: "Vector Search",
    };
  }

  if (
    signals.includes("fastify") ||
    signals.includes("express") ||
    signals.includes("node")
  ) {
    return {
      taxonomyL1: "Backend Engineering",
      taxonomyL2: "Node.js",
      taxonomyL3: "API Frameworks",
    };
  }

  return {
    taxonomyL1: "Software Engineering",
    taxonomyL2: "Developer Tooling",
    taxonomyL3: cluster.keywords[0]
      ? toTitleCase(cluster.keywords[0])
      : "General Topics",
  };
}

export function buildFallbackTopicNaming(
  cluster: TopicCluster,
  reason: TopicNamingFallbackReason,
): TopicNamingCandidate {
  const taxonomy = taxonomyFallback(cluster);
  const fallbackKeywords = sanitizeKeywords(cluster.keywords, []);
  return {
    status: "fallback-generated",
    label: toTitleCase(
      cluster.displayName || cluster.slug.replaceAll("-", " "),
    ),
    summary: cluster.summary,
    keywords: fallbackKeywords.length > 0 ? fallbackKeywords : ["topic"],
    taxonomyL1: taxonomy.taxonomyL1,
    taxonomyL2: taxonomy.taxonomyL2,
    taxonomyL3: taxonomy.taxonomyL3,
    fallbackReason: reason,
    metadata: {
      source: "deterministic-fallback",
      reason,
    },
  };
}

function hasKeywordOverlap(
  clusterKeywords: string[],
  candidateKeywords: string[],
): boolean {
  const clusterSet = new Set(clusterKeywords.map(normalizeToken));
  return candidateKeywords.some((keyword) =>
    clusterSet.has(normalizeToken(keyword)),
  );
}

export function validateTopicNamingCandidate(
  cluster: TopicCluster,
  candidate: TopicNamingLLMResponse,
  provider: string,
  model: string,
): TopicNamingCandidate | null {
  const label = normalizeWhitespace(candidate.label ?? "");
  const summary = normalizeWhitespace(candidate.summary ?? "");
  const keywords = sanitizeKeywords(candidate.keywords ?? [], cluster.keywords);
  const taxonomyL1 = normalizeWhitespace(candidate.taxonomy?.l1 ?? "");
  const taxonomyL2 = normalizeWhitespace(candidate.taxonomy?.l2 ?? "");
  const taxonomyL3 = normalizeWhitespace(candidate.taxonomy?.l3 ?? "");

  if (label.length < 3 || label.length > 96) {
    return null;
  }
  if (summary.length < 12 || summary.length > 360) {
    return null;
  }
  if (keywords.length < 3 || keywords.length > 10) {
    return null;
  }
  if (!hasKeywordOverlap(cluster.keywords, keywords)) {
    return null;
  }
  if (taxonomyL1.length === 0) {
    return null;
  }
  if (taxonomyL3.length > 0 && taxonomyL2.length === 0) {
    return null;
  }

  return {
    status: "llm-generated",
    label,
    summary,
    keywords,
    taxonomyL1: toTitleCase(taxonomyL1),
    taxonomyL2: taxonomyL2 ? toTitleCase(taxonomyL2) : undefined,
    taxonomyL3: taxonomyL3 ? toTitleCase(taxonomyL3) : undefined,
    provider,
    model,
    metadata: {
      source: "llm",
      keywordOverlap: true,
    },
  };
}

function slugPart(value: string): string {
  return normalizeToken(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTaxonomyNodes(
  naming: TopicNamingCandidate,
): Array<Pick<TopicNode, "slug" | "displayName" | "level" | "source">> {
  const levels = [
    { name: naming.taxonomyL1, level: "l1" as const },
    { name: naming.taxonomyL2, level: "l2" as const },
    { name: naming.taxonomyL3, level: "l3" as const },
  ].filter(
    (entry): entry is { name: string; level: "l1" | "l2" | "l3" } =>
      typeof entry.name === "string" && entry.name.length > 0,
  );

  const slugs: string[] = [];
  return levels.map((entry) => {
    slugs.push(slugPart(entry.name));
    return {
      slug: slugs.join("--"),
      displayName: toTitleCase(entry.name),
      level: entry.level,
      source: naming.status === "llm-generated" ? "llm" : "fallback",
    };
  });
}
