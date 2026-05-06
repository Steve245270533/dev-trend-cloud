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

export const RuntimeTopicSeedSourceLabelSchema = Type.Union([
  Type.Literal("ossinsight-hot"),
  Type.Literal("ossinsight-collections"),
  Type.Literal("devto-top"),
  Type.Literal("topic-cluster"),
  Type.Literal("fallback-topics"),
]);

export type RuntimeTopicSeedSourceLabel = Static<
  typeof RuntimeTopicSeedSourceLabelSchema
>;

export const RuntimeTopicSeedSchema = Type.Object({
  runId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  name: Type.String(),
  keywords: Type.Array(Type.String()),
  sourcePriority: Type.Integer({ minimum: 0 }),
  sources: Type.Array(RuntimeTopicSeedSourceLabelSchema),
  collectionId: Type.Optional(Type.String()),
  devtoTags: Type.Array(Type.String()),
  score: Type.Number({ minimum: 0 }),
  active: Type.Boolean(),
  refreshedAt: Type.String({ format: "date-time" }),
  expiresAt: Type.String({ format: "date-time" }),
  metadata: Type.Record(Type.String(), Type.Unknown()),
});

export type RuntimeTopicSeed = Static<typeof RuntimeTopicSeedSchema>;

export const RuntimeTopicSeedRunSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  status: Type.Union([
    Type.Literal("success"),
    Type.Literal("degraded"),
    Type.Literal("fallback"),
    Type.Literal("failed"),
  ]),
  startedAt: Type.String({ format: "date-time" }),
  finishedAt: Type.String({ format: "date-time" }),
  fallbackUsed: Type.Boolean(),
  errorText: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.Unknown()),
});

export type RuntimeTopicSeedRun = Static<typeof RuntimeTopicSeedRunSchema>;

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

export const SourceFeatureSharedSchema = Type.Object({
  score: Type.Optional(Type.Number()),
  answerCount: Type.Optional(Type.Integer({ minimum: 0 })),
  commentCount: Type.Optional(Type.Integer({ minimum: 0 })),
  reactionCount: Type.Optional(Type.Integer({ minimum: 0 })),
  viewCount: Type.Optional(Type.Integer({ minimum: 0 })),
  trendScore: Type.Optional(Type.Number()),
});

export type SourceFeatureShared = Static<typeof SourceFeatureSharedSchema>;

export const HackerNewsFeatureSchema = Type.Object({
  points: Type.Optional(Type.Integer({ minimum: 0 })),
  comments: Type.Optional(Type.Integer({ minimum: 0 })),
  postKind: Type.Optional(
    Type.Union([
      Type.Literal("ask"),
      Type.Literal("show"),
      Type.Literal("story"),
      Type.Literal("job"),
      Type.Literal("poll"),
    ]),
  ),
});

export type HackerNewsFeatures = Static<typeof HackerNewsFeatureSchema>;

export const StackOverflowFeatureSchema = Type.Object({
  answerCount: Type.Optional(Type.Integer({ minimum: 0 })),
  commentCount: Type.Optional(Type.Integer({ minimum: 0 })),
  viewCount: Type.Optional(Type.Integer({ minimum: 0 })),
  hasAcceptedAnswer: Type.Optional(Type.Boolean()),
});

export type StackOverflowFeatures = Static<typeof StackOverflowFeatureSchema>;

export const DevtoFeatureSchema = Type.Object({
  readingTimeMinutes: Type.Optional(Type.Integer({ minimum: 0 })),
  reactionsCount: Type.Optional(Type.Integer({ minimum: 0 })),
  commentsCount: Type.Optional(Type.Integer({ minimum: 0 })),
  tagDensity: Type.Optional(Type.Number({ minimum: 0 })),
  tutorialIntent: Type.Optional(Type.Boolean()),
});

export type DevtoFeatures = Static<typeof DevtoFeatureSchema>;

export const OssInsightFeatureSchema = Type.Object({
  starsGrowth: Type.Optional(Type.Number()),
  issueCreatorGrowth: Type.Optional(Type.Number()),
  prCreatorGrowth: Type.Optional(Type.Number()),
  collectionMembership: Type.Optional(Type.Array(Type.String())),
});

export type OssInsightFeatures = Static<typeof OssInsightFeatureSchema>;

export const SourceFeaturesSchema = Type.Object({
  shared: SourceFeatureSharedSchema,
  stackoverflow: Type.Optional(StackOverflowFeatureSchema),
  hackernews: Type.Optional(HackerNewsFeatureSchema),
  devto: Type.Optional(DevtoFeatureSchema),
  ossinsight: Type.Optional(OssInsightFeatureSchema),
});

export type SourceFeatures = Static<typeof SourceFeaturesSchema>;

export const UnifiedContentRecordSchema = Type.Object({
  canonicalId: Type.String(),
  source: SourceKeySchema,
  sourceItemId: Type.String(),
  title: Type.String(),
  summary: Type.String(),
  bodyExcerpt: Type.Optional(Type.String()),
  url: Type.String(),
  author: Type.Optional(Type.String()),
  publishedAt: Type.String({ format: "date-time" }),
  collectedAt: Type.String({ format: "date-time" }),
  timestampOrigin: TimestampOriginSchema,
  tags: Type.Array(Type.String()),
  sourceFeatures: SourceFeaturesSchema,
  fingerprint: Type.String(),
  evidenceRefs: Type.Array(Type.String()),
  legacyRefs: Type.Object({
    itemId: Type.String({ format: "uuid" }),
    itemSourceId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  }),
  rawMeta: Type.Record(Type.String(), Type.Unknown()),
});

export type UnifiedContentRecord = Static<typeof UnifiedContentRecordSchema>;

export const EmbeddingProviderSchema = Type.Union([Type.Literal("ollama")]);

export type EmbeddingProvider = Static<typeof EmbeddingProviderSchema>;

export const EmbeddingRecordSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  canonicalId: Type.String(),
  provider: EmbeddingProviderSchema,
  model: Type.String(),
  dimensions: Type.Integer({ minimum: 1 }),
  vector: Type.Array(Type.Number()),
  createdAt: Type.String({ format: "date-time" }),
});

export type EmbeddingRecord = Static<typeof EmbeddingRecordSchema>;

export const TopicClusterStatusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("superseded"),
]);

export type TopicClusterStatus = Static<typeof TopicClusterStatusSchema>;

export const RuntimeTopicFallbackReasonSchema = Type.Union([
  Type.Literal("missing-cluster"),
  Type.Literal("low-confidence"),
  Type.Literal("embedding-missing"),
  Type.Literal("candidate-conflict"),
  Type.Literal("insufficient-keywords"),
  Type.Literal("worker-error"),
]);

export type RuntimeTopicFallbackReason = Static<
  typeof RuntimeTopicFallbackReasonSchema
>;

export const TopicClusterEvidenceRoleSchema = Type.Union([
  Type.Literal("primary"),
  Type.Literal("supporting"),
]);

export type TopicClusterEvidenceRole = Static<
  typeof TopicClusterEvidenceRoleSchema
>;

export const TopicClusterRepresentativeEvidenceSchema = Type.Object({
  canonicalId: Type.String(),
  itemId: Type.String({ format: "uuid" }),
  source: SourceKeySchema,
  title: Type.String(),
  url: Type.String(),
  publishedAt: Type.String({ format: "date-time" }),
  collectedAt: Type.String({ format: "date-time" }),
  membershipConfidence: Type.Number({ minimum: 0, maximum: 1 }),
  role: TopicClusterEvidenceRoleSchema,
});

export type TopicClusterRepresentativeEvidence = Static<
  typeof TopicClusterRepresentativeEvidenceSchema
>;

export const TopicClusterSourceMixSchema = Type.Object({
  source: SourceKeySchema,
  count: Type.Integer({ minimum: 0 }),
  ratio: Type.Number({ minimum: 0, maximum: 1 }),
});

export type TopicClusterSourceMix = Static<typeof TopicClusterSourceMixSchema>;

export const TopicClusterMembershipSchema = Type.Object({
  topicClusterId: Type.String({ format: "uuid" }),
  clusterVersion: Type.String(),
  canonicalId: Type.String(),
  itemId: Type.String({ format: "uuid" }),
  embeddingRecordId: Type.Optional(Type.String({ format: "uuid" })),
  source: SourceKeySchema,
  membershipConfidence: Type.Number({ minimum: 0, maximum: 1 }),
  primaryEvidence: Type.Boolean(),
  evidenceRank: Type.Integer({ minimum: 1 }),
  reasoningTags: Type.Array(Type.String()),
  metadata: Type.Record(Type.String(), Type.Unknown()),
});

export type TopicClusterMembership = Static<
  typeof TopicClusterMembershipSchema
>;

export const TopicClusterSchema = Type.Object({
  topicClusterId: Type.String({ format: "uuid" }),
  stableKey: Type.String(),
  clusterVersion: Type.String(),
  ruleVersion: Type.String(),
  status: TopicClusterStatusSchema,
  slug: Type.String(),
  displayName: Type.String(),
  summary: Type.String(),
  keywords: Type.Array(Type.String()),
  anchorCanonicalId: Type.String(),
  representativeEvidence: Type.Array(TopicClusterRepresentativeEvidenceSchema),
  sourceMix: Type.Array(TopicClusterSourceMixSchema),
  relatedRepos: Type.Array(Type.String()),
  relatedEntities: Type.Array(Type.String()),
  itemCount: Type.Integer({ minimum: 0 }),
  clusterConfidence: Type.Number({ minimum: 0, maximum: 1 }),
  runtimeFallbackReason: Type.Optional(RuntimeTopicFallbackReasonSchema),
  metadata: Type.Record(Type.String(), Type.Unknown()),
});

export type TopicCluster = Static<typeof TopicClusterSchema>;

export const TopicNamingStatusSchema = Type.Union([
  Type.Literal("llm-generated"),
  Type.Literal("fallback-generated"),
]);

export type TopicNamingStatus = Static<typeof TopicNamingStatusSchema>;

export const TopicNamingFallbackReasonSchema = Type.Union([
  Type.Literal("provider-error"),
  Type.Literal("provider-timeout"),
  Type.Literal("missing-config"),
  Type.Literal("invalid-response"),
  Type.Literal("low-quality"),
]);

export type TopicNamingFallbackReason = Static<
  typeof TopicNamingFallbackReasonSchema
>;

export const TopicTaxonomyLevelSchema = Type.Union([
  Type.Literal("l1"),
  Type.Literal("l2"),
  Type.Literal("l3"),
]);

export type TopicTaxonomyLevel = Static<typeof TopicTaxonomyLevelSchema>;

export const TopicNodeSourceSchema = Type.Union([
  Type.Literal("llm"),
  Type.Literal("fallback"),
]);

export type TopicNodeSource = Static<typeof TopicNodeSourceSchema>;

export const TopicLabelCandidateSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  topicClusterId: Type.String({ format: "uuid" }),
  clusterVersion: Type.String(),
  status: TopicNamingStatusSchema,
  label: Type.String(),
  summary: Type.String(),
  keywords: Type.Array(Type.String()),
  taxonomyL1: Type.String(),
  taxonomyL2: Type.Optional(Type.String()),
  taxonomyL3: Type.Optional(Type.String()),
  fallbackReason: Type.Optional(TopicNamingFallbackReasonSchema),
  provider: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  metadata: Type.Record(Type.String(), Type.Unknown()),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export type TopicLabelCandidate = Static<typeof TopicLabelCandidateSchema>;

export const TopicNodeSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  slug: Type.String(),
  displayName: Type.String(),
  level: TopicTaxonomyLevelSchema,
  parentTopicId: Type.Optional(Type.String({ format: "uuid" })),
  source: TopicNodeSourceSchema,
  metadata: Type.Record(Type.String(), Type.Unknown()),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export type TopicNode = Static<typeof TopicNodeSchema>;

export const TopicLineageSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  topicClusterId: Type.String({ format: "uuid" }),
  clusterVersion: Type.String(),
  labelCandidateId: Type.String({ format: "uuid" }),
  l1TopicId: Type.String({ format: "uuid" }),
  l2TopicId: Type.Optional(Type.String({ format: "uuid" })),
  l3TopicId: Type.Optional(Type.String({ format: "uuid" })),
  pathSlugs: Type.Array(Type.String()),
  metadata: Type.Record(Type.String(), Type.Unknown()),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export type TopicLineage = Static<typeof TopicLineageSchema>;

export const TopicMembershipRoleSchema = Type.Union([
  Type.Literal("primary"),
  Type.Literal("supporting"),
]);

export type TopicMembershipRole = Static<typeof TopicMembershipRoleSchema>;

export const TopicMembershipSchema = Type.Object({
  topicClusterId: Type.String({ format: "uuid" }),
  clusterVersion: Type.String(),
  topicId: Type.String({ format: "uuid" }),
  membershipRole: TopicMembershipRoleSchema,
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
  metadata: Type.Record(Type.String(), Type.Unknown()),
});

export type TopicMembership = Static<typeof TopicMembershipSchema>;

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
