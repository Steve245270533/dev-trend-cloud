import type { SourceFeatures, UnifiedContentRecord } from "@devtrend/contracts";

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
  const validSources = new Set([
    "stackoverflow",
    "hackernews",
    "devto",
    "ossinsight",
  ]);

  return (
    typeof value.canonicalId === "string" &&
    validSources.has(source as string) &&
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
