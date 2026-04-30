import type {
  RuntimeTopicSeed,
  RuntimeTopicSeedSourceLabel,
} from "@devtrend/contracts";
import { runOpenCliJson } from "./opencli.js";

export interface RuntimeTopicCandidate {
  slug: string;
  name: string;
  keywords: string[];
  sourcePriority: number;
  sources: RuntimeTopicSeedSourceLabel[];
  collectionId?: string;
  devtoTags: string[];
  score: number;
  metadata: Record<string, unknown>;
}

export interface RuntimeTopicDiscoverySourceStatus {
  source: "ossinsight" | "devto";
  status: "success" | "failed";
  errorText: string | null;
  candidateCount: number;
}

export interface RuntimeTopicDiscoveryResult {
  candidates: RuntimeTopicCandidate[];
  sourceStatuses: RuntimeTopicDiscoverySourceStatus[];
}

type JsonRunner = (
  bin: string,
  argv: string[],
  timeoutMs: number,
) => Promise<Record<string, unknown>[]>;

const SOURCE_PRIORITIES: Record<RuntimeTopicSeedSourceLabel, number> = {
  "ossinsight-hot": 100,
  "ossinsight-collections": 80,
  "devto-top": 50,
  "fallback-topics": 10,
};

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9+ ]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isCollectionAllowed(name: string): boolean {
  const normalized = normalizeKeyword(name);
  return COLLECTION_ALLOWLIST.some((token) => normalized.includes(token));
}

function isTagSafe(tag: string): boolean {
  const normalized = normalizeKeyword(tag);
  return (
    normalized.length >= 2 &&
    normalized.length <= 24 &&
    /^[a-z0-9-]+$/.test(normalized.replaceAll(" ", "-")) &&
    TAG_ALLOWLIST.has(normalized)
  );
}

function buildCollectionKeywords(name: string): string[] {
  const normalized = normalizeKeyword(name);
  return dedupeStrings([
    normalized,
    ...normalized.split(" ").filter((token) => token.length > 2),
  ]);
}

function buildTopicCandidate(
  source: RuntimeTopicSeedSourceLabel,
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

export async function discoverRuntimeTopicCandidates(
  openCliBin: string,
  timeoutMs: number,
  runJson: JsonRunner = runOpenCliJson<Record<string, unknown>[]>,
): Promise<RuntimeTopicDiscoveryResult> {
  const candidates: RuntimeTopicCandidate[] = [];
  const sourceStatuses: RuntimeTopicDiscoverySourceStatus[] = [];

  const [hotResult, collectionsResult, devtoResult] = await Promise.allSettled([
    runJson(
      openCliBin,
      ["ossinsight", "hot-collections", "--limit", "100", "-f", "json"],
      timeoutMs,
    ),
    runJson(
      openCliBin,
      ["ossinsight", "collections", "--limit", "200", "-f", "json"],
      timeoutMs,
    ),
    runJson(
      openCliBin,
      ["devto", "top", "--limit", "30", "-f", "json"],
      timeoutMs,
    ),
  ]);

  let ossInsightCandidateCount = 0;

  if (hotResult.status === "fulfilled") {
    for (const entry of hotResult.value) {
      const name = typeof entry.name === "string" ? entry.name : "";
      if (!isCollectionAllowed(name)) {
        continue;
      }

      const score = Number(entry.rank_change ?? entry.current_rank ?? 0) + 100;
      const candidate = buildTopicCandidate("ossinsight-hot", name, {
        collectionId:
          typeof entry.id === "string" ? entry.id : String(entry.id ?? ""),
        score,
        metadata: {
          repoName:
            typeof entry.repo_name === "string" ? entry.repo_name : undefined,
        },
      });

      if (candidate) {
        candidates.push(candidate);
        ossInsightCandidateCount += 1;
      }
    }
  }

  if (collectionsResult.status === "fulfilled") {
    for (const entry of collectionsResult.value) {
      const name = typeof entry.name === "string" ? entry.name : "";
      if (!isCollectionAllowed(name)) {
        continue;
      }

      const candidate = buildTopicCandidate("ossinsight-collections", name, {
        collectionId:
          typeof entry.id === "string" ? entry.id : String(entry.id ?? ""),
      });

      if (candidate) {
        candidates.push(candidate);
        ossInsightCandidateCount += 1;
      }
    }
  }

  sourceStatuses.push({
    source: "ossinsight",
    status:
      hotResult.status === "fulfilled" ||
      collectionsResult.status === "fulfilled"
        ? "success"
        : "failed",
    errorText:
      hotResult.status === "rejected" && collectionsResult.status === "rejected"
        ? `${String(hotResult.reason)} | ${String(collectionsResult.reason)}`
        : hotResult.status === "rejected"
          ? String(hotResult.reason)
          : collectionsResult.status === "rejected"
            ? String(collectionsResult.reason)
            : null,
    candidateCount: ossInsightCandidateCount,
  });

  let devtoCandidateCount = 0;

  if (devtoResult.status === "fulfilled") {
    const tags = devtoResult.value.flatMap((entry) => {
      const raw = typeof entry.tags === "string" ? entry.tags : "";
      return raw
        .split(",")
        .map((tag) => normalizeKeyword(tag))
        .filter(isTagSafe);
    });

    for (const [index, tag] of dedupeStrings(tags).entries()) {
      const candidate = buildTopicCandidate("devto-top", tag, {
        devtoTags: [tag],
        score: 50 - index,
      });

      if (candidate) {
        candidates.push(candidate);
        devtoCandidateCount += 1;
      }
    }
  }

  sourceStatuses.push({
    source: "devto",
    status: devtoResult.status === "fulfilled" ? "success" : "failed",
    errorText:
      devtoResult.status === "rejected" ? String(devtoResult.reason) : null,
    candidateCount: devtoCandidateCount,
  });

  return {
    candidates,
    sourceStatuses,
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
      ).filter(isTagSafe),
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
