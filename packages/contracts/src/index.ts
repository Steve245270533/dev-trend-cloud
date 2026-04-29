import { type Static, type TSchema, Type } from "@sinclair/typebox";

export const SourceKeySchema = Type.Union([
  Type.Literal("stackoverflow"),
  Type.Literal("hackernews"),
  Type.Literal("devto"),
  Type.Literal("ossinsight"),
]);

export type SourceKey = Static<typeof SourceKeySchema>;

export const SourceStatusSchema = Type.Object({
  status: Type.Union([
    Type.Literal("healthy"),
    Type.Literal("degraded"),
    Type.Literal("failed"),
  ]),
  lastSuccessAt: Type.Union([
    Type.String({ format: "date-time" }),
    Type.Null(),
  ]),
  lastErrorAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  lastErrorText: Type.Union([Type.String(), Type.Null()]),
  fallbackUsed: Type.Boolean(),
  lastLatencyMs: Type.Integer({ minimum: 0 }),
});

export type SourceStatus = Static<typeof SourceStatusSchema>;

export const TimestampOriginSchema = Type.Union([
  Type.Literal("source"),
  Type.Literal("collected"),
]);

export type TimestampOrigin = Static<typeof TimestampOriginSchema>;

export const ResponseMetaSchema = Type.Object({
  generatedAt: Type.String({ format: "date-time" }),
  freshnessMinutes: Type.Integer({ minimum: 0 }),
  fallbackUsed: Type.Boolean(),
  sourceStatus: Type.Record(Type.String(), SourceStatusSchema),
  nextCursor: Type.Optional(Type.String()),
});

export type ResponseMeta = Static<typeof ResponseMetaSchema>;

export const MatchedTopicSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  slug: Type.String(),
  name: Type.String(),
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
  matchedKeywords: Type.Array(Type.String()),
});

export type MatchedTopic = Static<typeof MatchedTopicSchema>;

export const MatchedEntitySchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  slug: Type.String(),
  name: Type.String(),
  entityType: Type.String(),
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
  matchedKeywords: Type.Array(Type.String()),
  repoName: Type.Optional(Type.String()),
});

export type MatchedEntity = Static<typeof MatchedEntitySchema>;

export const NormalizedItemSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  source: SourceKeySchema,
  sourceItemId: Type.String(),
  title: Type.String(),
  summary: Type.String(),
  url: Type.String(),
  author: Type.Optional(Type.String()),
  publishedAt: Type.String({ format: "date-time" }),
  collectedAt: Type.String({ format: "date-time" }),
  timestampOrigin: TimestampOriginSchema,
  score: Type.Number(),
  answerCount: Type.Integer(),
  commentCount: Type.Integer(),
  tags: Type.Array(Type.String()),
  contentType: Type.String(),
  isQuestion: Type.Boolean(),
  rawMeta: Type.Record(Type.String(), Type.Unknown()),
});

export type NormalizedItem = Static<typeof NormalizedItemSchema>;

export const FeedItemSchema = Type.Composite([
  NormalizedItemSchema,
  Type.Object({
    topics: Type.Array(MatchedTopicSchema),
    entities: Type.Array(MatchedEntitySchema),
  }),
]);

export type FeedItem = Static<typeof FeedItemSchema>;

export const QuestionEvidenceSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  itemId: Type.String({ format: "uuid" }),
  source: SourceKeySchema,
  title: Type.String(),
  url: Type.String(),
  label: Type.String(),
  score: Type.Number(),
  publishedAt: Type.String({ format: "date-time" }),
  collectedAt: Type.String({ format: "date-time" }),
  sourceRunId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  snapshotId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
});

export type QuestionEvidence = Static<typeof QuestionEvidenceSchema>;

export const QuestionClusterSchema = Type.Object({
  clusterId: Type.String({ format: "uuid" }),
  canonicalQuestion: Type.String(),
  growthLabel: Type.String(),
  noveltyLabel: Type.String(),
  affectedTopics: Type.Array(Type.String()),
  affectedEntities: Type.Array(Type.String()),
  relatedRepos: Type.Array(Type.String()),
  sourceDistribution: Type.Record(Type.String(), Type.Integer()),
  evidenceCount: Type.Integer({ minimum: 0 }),
  confidenceScore: Type.Number({ minimum: 0 }),
  freshnessMinutes: Type.Integer({ minimum: 0 }),
  fallbackUsed: Type.Boolean(),
  recommendedAction: Type.String(),
});

export type QuestionCluster = Static<typeof QuestionClusterSchema>;

export const QuestionPressureSignalSchema = Type.Composite([
  QuestionClusterSchema,
  Type.Object({
    pressureScore: Type.Number({ minimum: 0 }),
    unresolvedVolume: Type.Integer({ minimum: 0 }),
  }),
]);

export type QuestionPressureSignal = Static<
  typeof QuestionPressureSignalSchema
>;

export const HealthPayloadSchema = Type.Object({
  status: Type.String(),
  timestamp: Type.String({ format: "date-time" }),
});

export type HealthPayload = Static<typeof HealthPayloadSchema>;

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
  statusCode: Type.Integer(),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

export const FeedQuerySchema = Type.Object({
  topic: Type.Optional(Type.String()),
  entity: Type.Optional(Type.String()),
  source: Type.Optional(SourceKeySchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  cursor: Type.Optional(Type.String()),
});

export type FeedQuery = Static<typeof FeedQuerySchema>;

export const QuestionPressureQuerySchema = Type.Object({
  topic: Type.Optional(Type.String()),
  entity: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  cursor: Type.Optional(Type.String()),
});

export type QuestionPressureQuery = Static<typeof QuestionPressureQuerySchema>;

export const ClusterParamsSchema = Type.Object({
  clusterId: Type.String({ format: "uuid" }),
});

export type ClusterParams = Static<typeof ClusterParamsSchema>;

export const EvidenceQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  cursor: Type.Optional(Type.String()),
});

export type EvidenceQuery = Static<typeof EvidenceQuerySchema>;

export function createResponseSchema(dataSchema: TSchema) {
  return Type.Object({
    data: dataSchema,
    meta: ResponseMetaSchema,
  });
}
