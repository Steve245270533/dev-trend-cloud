import { randomUUID } from "node:crypto";
import type { NormalizedItem, SourceKey } from "@devtrend/contracts";

function toIsoDate(value: unknown): string | null {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const epochMs = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(epochMs);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalizeUrl(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function resolvePublishedAt(
  collectedAt: string,
  ...values: unknown[]
): Pick<NormalizedItem, "publishedAt" | "timestampOrigin"> {
  for (const value of values) {
    const publishedAt = toIsoDate(value);
    if (publishedAt) {
      return {
        publishedAt,
        timestampOrigin: "source",
      };
    }
  }

  return {
    publishedAt: collectedAt,
    timestampOrigin: "collected",
  };
}

function isExplicitQuestionTitle(title: string): boolean {
  const normalizedTitle = title.trim();
  return (
    /\?$/.test(normalizedTitle) ||
    /^(how|why|what|when|where|who|which|can|does|do|is|are)\b/i.test(
      normalizedTitle,
    )
  );
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function inferHackerNewsQuestion(title: string): boolean {
  const normalizedTitle = title.trim();
  if (/^ask hn:/i.test(normalizedTitle)) {
    return true;
  }

  if (/^tell hn:/i.test(normalizedTitle)) {
    return isExplicitQuestionTitle(
      normalizedTitle.replace(/^tell hn:\s*/i, "").trim(),
    );
  }

  return isExplicitQuestionTitle(normalizedTitle);
}

function resolveHackerNewsSourceItemId(
  entry: Record<string, unknown>,
  commandName: string,
  index: number,
): string {
  if (typeof entry.id === "string" || typeof entry.id === "number") {
    return String(entry.id);
  }

  if (typeof entry.url === "string" && entry.url.trim().length > 0) {
    return entry.url.trim();
  }

  if (typeof entry.title === "string" && entry.title.trim().length > 0) {
    return `${commandName}:${entry.title.trim()}`;
  }

  return `${commandName}-${index}`;
}

function resolveHackerNewsUrl(entry: Record<string, unknown>): string {
  const directUrl = normalizeUrl(entry.url);
  if (directUrl) {
    return directUrl;
  }

  if (typeof entry.id === "string" || typeof entry.id === "number") {
    return `https://news.ycombinator.com/item?id=${String(entry.id)}`;
  }

  return "";
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

function resolveDevToUrl(entry: Record<string, unknown>): string {
  return normalizeUrl(entry.url);
}

function resolveOssInsightUrl(entry: Record<string, unknown>): string {
  const directUrl = normalizeUrl(entry.url);
  if (directUrl) {
    return directUrl;
  }

  const repoUrl = normalizeUrl(entry.repo_url);
  if (repoUrl) {
    return repoUrl;
  }

  const htmlUrl = normalizeUrl(entry.html_url);
  if (htmlUrl) {
    return htmlUrl;
  }

  const repoName = normalizeText(
    entry.repo_name ?? entry.repo ?? entry.name,
    "",
  );
  if (repoName.includes("/")) {
    return `https://github.com/${repoName}`;
  }

  return "";
}

function baseItem(
  source: SourceKey,
  sourceItemId: string,
  overrides: Partial<NormalizedItem>,
): NormalizedItem {
  const collectedAt = new Date().toISOString();
  return {
    id: randomUUID(),
    source,
    sourceItemId,
    title: "Untitled",
    summary: "",
    url: "",
    publishedAt: collectedAt,
    collectedAt,
    timestampOrigin: "collected",
    score: 0,
    answerCount: 0,
    commentCount: 0,
    tags: [],
    contentType: "feed",
    isQuestion: false,
    rawMeta: {},
    ...overrides,
  };
}

export function normalizeStackOverflow(
  entries: Record<string, unknown>[],
  commandName: string,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    return baseItem(
      "stackoverflow",
      String(entry.url ?? `${commandName}-${index}`),
      {
        title: normalizeText(entry.title, `Stack Overflow item ${index + 1}`),
        summary: normalizeText(entry.title, ""),
        url: resolveStackOverflowUrl(entry),
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
        score: Number(entry.score ?? 0),
        answerCount: Number(entry.answers ?? 0),
        tags: normalizeTags(entry.tags),
        contentType: commandName === "bounties" ? "bounty" : commandName,
        isQuestion: true,
        rawMeta: { commandName, ...entry },
      },
    );
  });
}

export function normalizeHackerNews(
  entries: Record<string, unknown>[],
  commandName: string,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    const title = normalizeText(entry.title, `Hacker News item ${index + 1}`);
    return baseItem(
      "hackernews",
      resolveHackerNewsSourceItemId(entry, commandName, index),
      {
        title,
        summary: normalizeText(entry.author, ""),
        url: resolveHackerNewsUrl(entry),
        collectedAt,
        ...resolvePublishedAt(
          collectedAt,
          entry.created_at,
          entry.createdAt,
          entry.time,
          entry.published_at,
          entry.date,
        ),
        score: Number(entry.score ?? 0),
        commentCount: Number(entry.comments ?? 0),
        contentType: commandName,
        isQuestion: inferHackerNewsQuestion(title),
        rawMeta: { commandName, ...entry },
      },
    );
  });
}

export function normalizeDevTo(
  entries: Record<string, unknown>[],
  commandName: string,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    return baseItem(
      "devto",
      String(entry.url ?? entry.title ?? `${commandName}-${index}`),
      {
        title: normalizeText(entry.title, `DEV item ${index + 1}`),
        summary: normalizeText(entry.author, ""),
        url: resolveDevToUrl(entry),
        collectedAt,
        ...resolvePublishedAt(
          collectedAt,
          entry.published_at,
          entry.publishedAt,
          entry.created_at,
        ),
        score: Number(entry.reactions ?? 0),
        commentCount: Number(entry.comments ?? 0),
        tags: normalizeTags(entry.tags),
        contentType: commandName,
        isQuestion: isExplicitQuestionTitle(String(entry.title ?? "")),
        rawMeta: { commandName, ...entry },
      },
    );
  });
}

export function normalizeOssInsight(
  entries: Record<string, unknown>[],
  commandName: string,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const collectedAt = new Date().toISOString();
    const repoName = normalizeText(
      entry.repo_name ?? entry.repo ?? entry.name,
      `OSS Insight item ${index + 1}`,
    );
    return baseItem("ossinsight", `${commandName}-${repoName}-${index}`, {
      title: repoName,
      summary: normalizeText(
        entry.language ?? entry.collection_name ?? entry.period ?? commandName,
        commandName,
      ),
      url: resolveOssInsightUrl(entry),
      collectedAt,
      ...resolvePublishedAt(
        collectedAt,
        entry.date,
        entry.timestamp,
        entry.created_at,
      ),
      score: Number(entry.stars ?? entry.value ?? entry.count ?? 0),
      contentType: commandName,
      rawMeta: { commandName, ...entry },
    });
  });
}

export function normalizeSourcePayload(
  source: SourceKey,
  commandName: string,
  entries: Record<string, unknown>[],
): NormalizedItem[] {
  switch (source) {
    case "stackoverflow":
      return normalizeStackOverflow(entries, commandName);
    case "hackernews":
      return normalizeHackerNews(entries, commandName);
    case "devto":
      return normalizeDevTo(entries, commandName);
    case "ossinsight":
      return normalizeOssInsight(entries, commandName);
  }
}
