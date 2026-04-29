import { randomUUID } from "node:crypto";
import type {
  NormalizedItem,
  SourceKey,
} from "../../../contracts/src/index.js";

function toIsoDate(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function baseItem(
  source: SourceKey,
  sourceItemId: string,
  overrides: Partial<NormalizedItem>,
): NormalizedItem {
  return {
    id: randomUUID(),
    source,
    sourceItemId,
    title: "Untitled",
    summary: "",
    url: "",
    publishedAt: new Date().toISOString(),
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
  return entries.map((entry, index) =>
    baseItem("stackoverflow", String(entry.url ?? `${commandName}-${index}`), {
      title: normalizeText(entry.title, `Stack Overflow item ${index + 1}`),
      summary: normalizeText(entry.title, ""),
      url: normalizeText(
        entry.url,
        `https://stackoverflow.com/questions/${index + 1}`,
      ),
      publishedAt: new Date().toISOString(),
      score: Number(entry.score ?? 0),
      answerCount: Number(entry.answers ?? 0),
      tags: [],
      contentType: commandName === "bounties" ? "bounty" : commandName,
      isQuestion: true,
      rawMeta: { commandName, ...entry },
    }),
  );
}

export function normalizeHackerNews(
  entries: Record<string, unknown>[],
  commandName: string,
): NormalizedItem[] {
  return entries.map((entry, index) =>
    baseItem(
      "hackernews",
      String(entry.url ?? entry.title ?? `${commandName}-${index}`),
      {
        title: normalizeText(entry.title, `Hacker News item ${index + 1}`),
        summary: normalizeText(entry.author, ""),
        url: normalizeText(
          entry.url,
          `https://news.ycombinator.com/item?id=${String(entry.id ?? index + 1)}`,
        ),
        publishedAt: new Date().toISOString(),
        score: Number(entry.score ?? 0),
        commentCount: Number(entry.comments ?? 0),
        contentType: commandName,
        isQuestion:
          commandName === "ask" || /\?$/.test(String(entry.title ?? "")),
        rawMeta: { commandName, ...entry },
      },
    ),
  );
}

export function normalizeDevTo(
  entries: Record<string, unknown>[],
  commandName: string,
): NormalizedItem[] {
  return entries.map((entry, index) =>
    baseItem(
      "devto",
      String(entry.url ?? entry.title ?? `${commandName}-${index}`),
      {
        title: normalizeText(entry.title, `DEV item ${index + 1}`),
        summary: normalizeText(entry.author, ""),
        url: normalizeText(entry.url, `https://dev.to/example/${index + 1}`),
        publishedAt: toIsoDate(entry.published_at),
        score: Number(entry.reactions ?? 0),
        commentCount: Number(entry.comments ?? 0),
        tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
        contentType: commandName,
        isQuestion: /\?$/.test(String(entry.title ?? "")),
        rawMeta: { commandName, ...entry },
      },
    ),
  );
}

export function normalizeOssInsight(
  entries: Record<string, unknown>[],
  commandName: string,
): NormalizedItem[] {
  return entries.map((entry, index) => {
    const repoName = normalizeText(
      entry.repo_name ?? entry.repo ?? entry.name,
      `repo-${index + 1}`,
    );
    return baseItem("ossinsight", `${commandName}-${repoName}-${index}`, {
      title: repoName,
      summary: normalizeText(
        entry.language ?? entry.collection_name ?? entry.period ?? commandName,
        commandName,
      ),
      url: repoName.includes("/")
        ? `https://github.com/${repoName}`
        : `https://ossinsight.io/${repoName}`,
      publishedAt: toIsoDate(entry.date),
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
