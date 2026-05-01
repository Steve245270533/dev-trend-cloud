import type { RuntimeTopicSeed } from "@devtrend/contracts";
import type { RuntimeTopicCandidate } from "../types.js";

const SOURCE_PRIORITIES = {
  "ossinsight-hot": 100,
  "ossinsight-collections": 80,
  "devto-top": 50,
  "fallback-topics": 10,
} as const;

const COLLECTION_ALLOWLIST = [
  "ai",
  "artificial intelligence",
  "agent",
  "framework",
  "frontend",
  "backend",
  "api",
  "database",
  "data",
  "testing",
  "security",
  "serverless",
  "devops",
  "build",
  "tool",
  "tooling",
  "monitoring",
  "scheduler",
  "mobile",
  "typescript",
  "javascript",
  "css",
  "react",
  "web",
  "infra",
  "mlops",
  "terminal",
  "observability",
];

const TAG_ALLOWLIST = new Set([
  "ai",
  "agents",
  "mcp",
  "rag",
  "frontend",
  "backend",
  "webdev",
  "typescript",
  "javascript",
  "react",
  "vue",
  "css",
  "api",
  "fastify",
  "node",
  "serverless",
  "aws",
  "devops",
  "testing",
  "playwright",
  "postgres",
  "database",
  "security",
  "mobile",
  "ios",
  "android",
  "data",
  "python",
  "llm",
  "observability",
]);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9+ ]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function isCollectionAllowed(name: string): boolean {
  const normalized = normalizeKeyword(name);
  return COLLECTION_ALLOWLIST.some((token) => normalized.includes(token));
}

export function isSafeRuntimeTag(tag: string): boolean {
  const normalized = normalizeKeyword(tag);
  return (
    normalized.length >= 2 &&
    normalized.length <= 24 &&
    /^[a-z0-9-]+$/.test(normalized.replaceAll(" ", "-")) &&
    TAG_ALLOWLIST.has(normalized)
  );
}

export function buildCollectionKeywords(name: string): string[] {
  const normalized = normalizeKeyword(name);
  return dedupeStrings([
    normalized,
    ...normalized.split(" ").filter((token) => token.length > 2),
  ]);
}

export function buildRuntimeTopicCandidate(
  source: RuntimeTopicCandidate["sources"][number],
  name: string,
  extras: {
    collectionId?: string;
    devtoTags?: string[];
    score?: number;
    metadata?: Record<string, unknown>;
  } = {},
): RuntimeTopicCandidate | null {
  const normalizedName = name.trim();
  const slug = slugify(normalizedName);

  if (slug.length === 0) {
    return null;
  }

  return {
    slug,
    name: normalizedName,
    keywords: buildCollectionKeywords(normalizedName),
    sourcePriority: SOURCE_PRIORITIES[source],
    sources: [source],
    collectionId: extras.collectionId,
    devtoTags: extras.devtoTags ?? [],
    score: extras.score ?? SOURCE_PRIORITIES[source],
    metadata: extras.metadata ?? {},
  };
}

export function normalizeRuntimeTopicCandidates(
  candidates: RuntimeTopicCandidate[],
): RuntimeTopicCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      slug: slugify(candidate.slug),
      name: candidate.name.trim(),
      keywords: dedupeStrings(candidate.keywords.map(normalizeKeyword)),
      devtoTags: dedupeStrings(
        candidate.devtoTags.map(normalizeKeyword),
      ).filter(isSafeRuntimeTag),
    }))
    .filter(
      (candidate) =>
        candidate.slug.length > 0 &&
        candidate.name.length > 0 &&
        candidate.keywords.length > 0,
    );
}

export function mergeRuntimeTopicCandidates(
  candidates: RuntimeTopicCandidate[],
  fallbackTopics: RuntimeTopicSeed[],
  now = new Date(),
): RuntimeTopicSeed[] {
  const merged = new Map<string, RuntimeTopicSeed>();
  const refreshedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const put = (
    slug: string,
    next: Omit<RuntimeTopicSeed, "runId" | "refreshedAt" | "expiresAt">,
  ) => {
    const current = merged.get(slug);
    if (!current) {
      merged.set(slug, {
        ...next,
        runId: "00000000-0000-5000-8000-000000000000",
        refreshedAt,
        expiresAt,
      });
      return;
    }

    merged.set(slug, {
      ...current,
      name:
        next.sourcePriority >= current.sourcePriority
          ? next.name
          : current.name,
      keywords: dedupeStrings([...current.keywords, ...next.keywords]),
      sourcePriority: Math.max(current.sourcePriority, next.sourcePriority),
      sources: dedupeStrings([...current.sources, ...next.sources]).map(
        (value) => value as RuntimeTopicSeed["sources"][number],
      ),
      collectionId: current.collectionId ?? next.collectionId,
      devtoTags: dedupeStrings([...current.devtoTags, ...next.devtoTags]),
      score: Math.max(current.score, next.score),
      active: current.active || next.active,
      metadata: {
        ...current.metadata,
        ...next.metadata,
      },
      refreshedAt,
      expiresAt,
    });
  };

  for (const fallbackTopic of fallbackTopics) {
    put(fallbackTopic.slug, {
      slug: fallbackTopic.slug,
      name: fallbackTopic.name,
      keywords: fallbackTopic.keywords,
      sourcePriority: SOURCE_PRIORITIES["fallback-topics"],
      sources: ["fallback-topics"],
      collectionId: fallbackTopic.collectionId,
      devtoTags: fallbackTopic.devtoTags,
      score: fallbackTopic.score,
      active: true,
      metadata: {
        ...fallbackTopic.metadata,
        source: "topics",
      },
    });
  }

  for (const candidate of normalizeRuntimeTopicCandidates(candidates)) {
    put(candidate.slug, {
      slug: candidate.slug,
      name: candidate.name,
      keywords: candidate.keywords,
      sourcePriority: candidate.sourcePriority,
      sources: candidate.sources,
      collectionId: candidate.collectionId,
      devtoTags: candidate.devtoTags,
      score: candidate.score,
      active: true,
      metadata: candidate.metadata,
    });
  }

  return [...merged.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.slug.localeCompare(right.slug);
  });
}
