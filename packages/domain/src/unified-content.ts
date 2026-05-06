import { createHash } from "node:crypto";
import type {
  SourceFeatures,
  SourceKey,
  UnifiedContentRecord,
} from "@devtrend/contracts";

const VALID_SOURCES = new Set<SourceKey>([
  "stackoverflow",
  "hackernews",
  "devto",
  "ossinsight",
]);

const EMBEDDING_INPUT_MAX_LENGTH = 4_000;

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function isOptionalNonNegativeInteger(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isInteger(value) && value >= 0)
  );
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

function isValidSourceFeatureShared(value: unknown): boolean {
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    isOptionalNumber(value.score) &&
    isOptionalNonNegativeInteger(value.answerCount) &&
    isOptionalNonNegativeInteger(value.commentCount) &&
    isOptionalNonNegativeInteger(value.reactionCount) &&
    isOptionalNonNegativeInteger(value.viewCount) &&
    isOptionalNumber(value.trendScore)
  );
}

function isValidStackOverflowFeatures(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    isOptionalNonNegativeInteger(value.answerCount) &&
    isOptionalNonNegativeInteger(value.commentCount) &&
    isOptionalNonNegativeInteger(value.viewCount) &&
    (value.hasAcceptedAnswer === undefined ||
      typeof value.hasAcceptedAnswer === "boolean")
  );
}

function isValidHackerNewsFeatures(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isObjectLike(value)) {
    return false;
  }

  const validPostKinds = new Set(["ask", "show", "story", "job", "poll"]);
  const postKind = value.postKind;

  return (
    isOptionalNonNegativeInteger(value.points) &&
    isOptionalNonNegativeInteger(value.comments) &&
    (postKind === undefined ||
      (typeof postKind === "string" && validPostKinds.has(postKind)))
  );
}

function isValidDevtoFeatures(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    isOptionalNonNegativeInteger(value.readingTimeMinutes) &&
    isOptionalNonNegativeInteger(value.reactionsCount) &&
    isOptionalNonNegativeInteger(value.commentsCount) &&
    (value.tagDensity === undefined ||
      (typeof value.tagDensity === "number" && value.tagDensity >= 0)) &&
    (value.tutorialIntent === undefined ||
      typeof value.tutorialIntent === "boolean")
  );
}

function isValidOssInsightFeatures(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    isOptionalNumber(value.starsGrowth) &&
    isOptionalNumber(value.issueCreatorGrowth) &&
    isOptionalNumber(value.prCreatorGrowth) &&
    (value.collectionMembership === undefined ||
      isStringArray(value.collectionMembership))
  );
}

export function isValidSourceFeatures(value: unknown): value is SourceFeatures {
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    isValidSourceFeatureShared(value.shared) &&
    isValidStackOverflowFeatures(value.stackoverflow) &&
    isValidHackerNewsFeatures(value.hackernews) &&
    isValidDevtoFeatures(value.devto) &&
    isValidOssInsightFeatures(value.ossinsight)
  );
}

export function isUnifiedContentRecord(
  value: unknown,
): value is UnifiedContentRecord {
  if (!isObjectLike(value) || !isObjectLike(value.legacyRefs)) {
    return false;
  }

  const source = value.source;
  const timestampOrigin = value.timestampOrigin;

  return (
    typeof value.canonicalId === "string" &&
    VALID_SOURCES.has(source as SourceKey) &&
    typeof value.sourceItemId === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    (value.bodyExcerpt === undefined ||
      typeof value.bodyExcerpt === "string") &&
    typeof value.url === "string" &&
    (value.author === undefined || typeof value.author === "string") &&
    typeof value.publishedAt === "string" &&
    typeof value.collectedAt === "string" &&
    (timestampOrigin === "source" || timestampOrigin === "collected") &&
    isStringArray(value.tags) &&
    isValidSourceFeatures(value.sourceFeatures) &&
    typeof value.fingerprint === "string" &&
    isStringArray(value.evidenceRefs) &&
    typeof value.legacyRefs.itemId === "string" &&
    (value.legacyRefs.itemSourceId === null ||
      typeof value.legacyRefs.itemSourceId === "string") &&
    isObjectLike(value.rawMeta)
  );
}

export interface EmbeddingInputRecord {
  canonicalId: string;
  source: SourceKey;
  title: string;
  summary: string;
  bodyExcerpt?: string;
  tags: string[];
}

export interface EmbeddingInputPayload {
  canonicalId: string;
  source: SourceKey;
  input: string;
  inputFingerprint: string;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => normalizeText(tag).toLowerCase())
    .filter((tag) => tag.length > 0);
  return [...new Set(normalized)].sort((left, right) =>
    left.localeCompare(right),
  );
}

function truncateInput(value: string): string {
  if (value.length <= EMBEDDING_INPUT_MAX_LENGTH) {
    return value;
  }
  return value.slice(0, EMBEDDING_INPUT_MAX_LENGTH);
}

export function isEmbeddingInputRecord(
  value: unknown,
): value is EmbeddingInputRecord {
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    typeof value.canonicalId === "string" &&
    value.canonicalId.trim().length > 0 &&
    VALID_SOURCES.has(value.source as SourceKey) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    typeof value.summary === "string" &&
    value.summary.trim().length > 0 &&
    (value.bodyExcerpt === undefined ||
      typeof value.bodyExcerpt === "string") &&
    isStringArray(value.tags)
  );
}

export function buildEmbeddingInput(
  record: EmbeddingInputRecord,
): EmbeddingInputPayload {
  const title = normalizeText(record.title);
  const summary = normalizeText(record.summary);
  const bodyExcerpt =
    typeof record.bodyExcerpt === "string"
      ? normalizeText(record.bodyExcerpt)
      : "";
  const tags = normalizeTags(record.tags);
  const sections = [
    `source:${record.source}`,
    `title:${title}`,
    `summary:${summary}`,
    bodyExcerpt.length > 0 ? `bodyExcerpt:${bodyExcerpt}` : "",
    tags.length > 0 ? `tags:${tags.join(",")}` : "",
  ].filter((section) => section.length > 0);
  const input = truncateInput(sections.join("\n"));
  const inputFingerprint = `sha256:${createHash("sha256").update(input).digest("hex")}`;

  return {
    canonicalId: record.canonicalId,
    source: record.source,
    input,
    inputFingerprint,
  };
}

export function buildEmbeddingInputFromUnifiedContent(
  value: unknown,
): EmbeddingInputPayload | null {
  if (!isEmbeddingInputRecord(value)) {
    return null;
  }

  return buildEmbeddingInput({
    canonicalId: value.canonicalId,
    source: value.source,
    title: value.title,
    summary: value.summary,
    bodyExcerpt: value.bodyExcerpt,
    tags: value.tags,
  });
}
