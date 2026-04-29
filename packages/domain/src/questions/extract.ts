import type {
  MatchedEntity,
  MatchedTopic,
  NormalizedItem,
} from "@devtrend/contracts";

const QUESTION_PATTERNS = [
  /\?$/,
  /^ask hn:/i,
  /^how\b/i,
  /^why\b/i,
  /^what\b/i,
  /^when\b/i,
  /^where\b/i,
  /^is it\b/i,
  /^can\b/i,
];

const LONG_TAIL_THRESHOLD_DAYS = 180;

export interface QuestionFeatures {
  isQuestion: boolean;
  unresolvedVolume: number;
  growthBoost: number;
  repeatedSimilaritySeed: string;
  noveltyLabel: "recurring-pain" | "new-spike" | "long-tail-unresolved";
}

export interface EnrichedItem {
  item: NormalizedItem;
  topics: MatchedTopic[];
  entities: MatchedEntity[];
  question: QuestionFeatures;
}

function daysSince(dateIso: string): number {
  const elapsedMs = Date.now() - new Date(dateIso).getTime();
  return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
}

export function normalizeQuestionTitle(title: string): string {
  return title
    .replaceAll(/^(ask hn:|tell hn:)\s*/gi, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9 ]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function normalizeSignature(title: string): string {
  return normalizeQuestionTitle(title)
    .replaceAll(/\b(the|a|an|with|for|and|or|to|of|in)\b/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

export function extractQuestionFeatures(
  item: NormalizedItem,
  topics: MatchedTopic[],
  entities: MatchedEntity[],
): QuestionFeatures {
  const normalizedTitle = item.title.trim();
  const explicitQuestion = QUESTION_PATTERNS.some((pattern) =>
    pattern.test(normalizedTitle),
  );
  const stackOverflowSignal =
    item.source === "stackoverflow" &&
    (item.answerCount === 0 ||
      item.contentType === "bounty" ||
      item.contentType === "unanswered");
  const questionish =
    item.isQuestion || explicitQuestion || stackOverflowSignal;
  const unresolvedVolume = Math.max(
    0,
    (item.answerCount === 0 ? 2 : 0) +
      (item.contentType === "bounty" ? 2 : 0) +
      (item.score > 5 ? 1 : 0) +
      (topics.length > 0 ? 1 : 0) +
      (entities.length > 0 ? 1 : 0),
  );
  const ageDays = daysSince(item.publishedAt);
  const noveltyLabel =
    ageDays > LONG_TAIL_THRESHOLD_DAYS
      ? "long-tail-unresolved"
      : item.score > 10 || item.commentCount > 15
        ? "new-spike"
        : "recurring-pain";

  return {
    isQuestion: questionish,
    unresolvedVolume,
    growthBoost: item.score > 10 || item.commentCount > 10 ? 1.25 : 0.75,
    repeatedSimilaritySeed: normalizeSignature(item.title),
    noveltyLabel,
  };
}
