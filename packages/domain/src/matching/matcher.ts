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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9+/ -]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function includesKeyword(haystack: string, keyword: string): boolean {
  return haystack.includes(normalizeText(keyword));
}

function matchTopic(itemText: string, topic: TopicSeed): MatchedTopic | null {
  const matchedKeywords = topic.keywords.filter((keyword) =>
    includesKeyword(itemText, keyword),
  );
  const repoMatched = topic.repoPatterns.some((repo) =>
    includesKeyword(itemText, repo),
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
  itemText: string,
  entity: EntitySeed,
): MatchedEntity | null {
  const matchedKeywords = entity.aliases.filter((keyword) =>
    includesKeyword(itemText, keyword),
  );
  const matchedRepo = entity.repos.find((repo) =>
    includesKeyword(itemText, repo),
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
  const itemText = normalizeText(
    [
      item.title,
      item.summary,
      item.url,
      item.tags.join(" "),
      JSON.stringify(item.rawMeta),
    ].join(" "),
  );

  return {
    topics: topicSeeds
      .map((topic) => matchTopic(itemText, topic))
      .filter((value): value is MatchedTopic => value !== null),
    entities: entitySeeds
      .map((entity) => matchEntity(itemText, entity))
      .filter((value): value is MatchedEntity => value !== null),
  };
}
