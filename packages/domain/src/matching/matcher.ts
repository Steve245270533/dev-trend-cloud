import type {
  MatchedEntity,
  MatchedTopic,
  NormalizedItem,
} from "@devtrend/contracts";
import {
  type EntitySeed,
  entitySeeds,
  type TopicSeed,
  topicSeeds,
} from "./catalog.js";

interface CatalogMatchResult {
  topics: MatchedTopic[];
  entities: MatchedEntity[];
}

export interface MatchContext {
  freeText: string;
  freeTextTokens: Set<string>;
  tags: Set<string>;
  structuredText: string;
  structuredTokens: Set<string>;
  structuredPhrases: Set<string>;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9+/ -]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function tokenizeNormalized(value: string): string[] {
  return value.length === 0 ? [] : value.split(" ").filter(Boolean);
}

function collectRawMetaStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectRawMetaStrings(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((entry) =>
      collectRawMetaStrings(entry),
    );
  }

  return [];
}

function withUrlParts(value: string): string[] {
  const parts = [value];

  try {
    const parsed = new URL(value);
    parts.push(
      parsed.hostname,
      parsed.pathname,
      parsed.pathname.replace(/^\/+/, ""),
    );
  } catch {
    // The item URL may already be a path-like identifier.
  }

  return parts;
}

export function buildMatchContext(item: NormalizedItem): MatchContext {
  const rawMetaStrings = collectRawMetaStrings(item.rawMeta);
  const freeText = normalizeText(
    [item.title, item.summary, ...rawMetaStrings].join(" "),
  );
  const structuredValues = [
    item.sourceItemId,
    ...withUrlParts(item.url),
    ...item.tags,
    ...rawMetaStrings,
  ]
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);
  const structuredText = structuredValues.join(" ");

  return {
    freeText,
    freeTextTokens: new Set(tokenizeNormalized(freeText)),
    tags: new Set(item.tags.map((tag) => normalizeText(tag)).filter(Boolean)),
    structuredText,
    structuredTokens: new Set(tokenizeNormalized(structuredText)),
    structuredPhrases: new Set(structuredValues),
  };
}

function includesWholePhrase(haystack: string, phrase: string): boolean {
  return (
    haystack === phrase ||
    haystack.startsWith(`${phrase} `) ||
    haystack.endsWith(` ${phrase}`) ||
    haystack.includes(` ${phrase} `)
  );
}

export function matchesKeyword(
  context: MatchContext,
  keyword: string,
  options?: {
    structuredOnly?: boolean;
  },
): boolean {
  const normalizedKeyword = normalizeText(keyword);
  if (normalizedKeyword.length === 0) {
    return false;
  }

  const keywordTokens = tokenizeNormalized(normalizedKeyword);
  if (keywordTokens.length === 0) {
    return false;
  }

  const structuredOnly = options?.structuredOnly ?? false;
  const lastToken = keywordTokens[keywordTokens.length - 1] ?? "";

  if (keywordTokens.length > 1) {
    if (context.structuredPhrases.has(normalizedKeyword)) {
      return true;
    }

    if (structuredOnly) {
      return includesWholePhrase(context.structuredText, normalizedKeyword);
    }

    return (
      includesWholePhrase(context.structuredText, normalizedKeyword) ||
      includesWholePhrase(context.freeText, normalizedKeyword)
    );
  }

  if (lastToken.length <= 2) {
    return (
      context.tags.has(lastToken) ||
      context.structuredTokens.has(lastToken) ||
      context.structuredPhrases.has(lastToken)
    );
  }

  if (context.structuredTokens.has(lastToken)) {
    return true;
  }

  return !structuredOnly && context.freeTextTokens.has(lastToken);
}

function matchTopic(
  context: MatchContext,
  topic: TopicSeed,
): MatchedTopic | null {
  const matchedKeywords = topic.keywords.filter((keyword) =>
    matchesKeyword(context, keyword),
  );
  const repoMatched = topic.repoPatterns.some((repo) =>
    matchesKeyword(context, repo, { structuredOnly: true }),
  );

  if (matchedKeywords.length === 0 && !repoMatched) {
    return null;
  }

  const confidence = Math.min(
    1,
    0.3 + matchedKeywords.length * 0.2 + (repoMatched ? 0.25 : 0),
  );
  return {
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    confidence,
    matchedKeywords,
  };
}

function matchEntity(
  context: MatchContext,
  entity: EntitySeed,
): MatchedEntity | null {
  const matchedKeywords = entity.aliases.filter((keyword) =>
    matchesKeyword(context, keyword),
  );
  const matchedRepo = entity.repos.find((repo) =>
    matchesKeyword(context, repo, { structuredOnly: true }),
  );

  if (matchedKeywords.length === 0 && !matchedRepo) {
    return null;
  }

  const confidence = Math.min(
    1,
    0.35 + matchedKeywords.length * 0.2 + (matchedRepo ? 0.2 : 0),
  );
  return {
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    entityType: entity.entityType,
    confidence,
    matchedKeywords,
    repoName: matchedRepo,
  };
}

export function matchCatalog(item: NormalizedItem): CatalogMatchResult {
  const context = buildMatchContext(item);

  return {
    topics: topicSeeds
      .map((topic) => matchTopic(context, topic))
      .filter((value): value is MatchedTopic => value !== null),
    entities: entitySeeds
      .map((entity) => matchEntity(context, entity))
      .filter((value): value is MatchedEntity => value !== null),
  };
}
