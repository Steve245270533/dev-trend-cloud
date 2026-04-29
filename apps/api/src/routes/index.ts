import {
  ClusterParamsSchema,
  createResponseSchema,
  ErrorResponseSchema,
  EvidenceQuerySchema,
  FeedItemSchema,
  FeedQuerySchema,
  HealthPayloadSchema,
  QuestionClusterSchema,
  QuestionEvidenceSchema,
  QuestionPressureQuerySchema,
  QuestionPressureSignalSchema,
  type SourceStatus,
} from "@devtrend/contracts";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import type { ReadServices } from "../services/types.js";

function buildMeta(sourceStatus: Record<string, SourceStatus>) {
  const dates = Object.values(sourceStatus)
    .map((status) =>
      status.lastSuccessAt ? new Date(status.lastSuccessAt).getTime() : null,
    )
    .filter((value): value is number => value !== null);
  const oldestSuccess = dates.length > 0 ? Math.min(...dates) : Date.now();

  return {
    generatedAt: new Date().toISOString(),
    freshnessMinutes: Math.max(
      0,
      Math.floor((Date.now() - oldestSuccess) / (1000 * 60)),
    ),
    fallbackUsed: Object.values(sourceStatus).some(
      (status) => status.fallbackUsed,
    ),
    sourceStatus,
  };
}

export function createRoutes(
  services: ReadServices,
): FastifyPluginAsyncTypebox {
  return async function routes(app) {
    app.get(
      "/healthz",
      {
        schema: {
          response: {
            200: HealthPayloadSchema,
          },
        },
      },
      async () => ({
        status: (await services.checkHealth()) ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
      }),
    );

    app.get(
      "/readyz",
      {
        schema: {
          response: {
            200: HealthPayloadSchema,
          },
        },
      },
      async () => ({
        status: (await services.checkReadiness()) ? "ready" : "not-ready",
        timestamp: new Date().toISOString(),
      }),
    );

    app.get(
      "/feed",
      {
        schema: {
          querystring: FeedQuerySchema,
          response: {
            200: createResponseSchema(Type.Array(FeedItemSchema)),
            400: ErrorResponseSchema,
          },
        },
      },
      async (request) => {
        const sourceStatus = await services.getSourceStatus();
        const data = await services.getFeed(request.query);
        return {
          data,
          meta: buildMeta(sourceStatus),
        };
      },
    );

    app.get(
      "/signals/question-pressure",
      {
        schema: {
          querystring: QuestionPressureQuerySchema,
          response: {
            200: createResponseSchema(Type.Array(QuestionPressureSignalSchema)),
            400: ErrorResponseSchema,
          },
        },
      },
      async (request) => {
        const sourceStatus = await services.getSourceStatus();
        const data = await services.getQuestionPressure(request.query);
        return {
          data,
          meta: buildMeta(sourceStatus),
        };
      },
    );

    app.get(
      "/question-clusters/:clusterId",
      {
        schema: {
          params: ClusterParamsSchema,
          response: {
            200: createResponseSchema(QuestionClusterSchema),
            404: ErrorResponseSchema,
          },
        },
      },
      async (request, _reply) => {
        const sourceStatus = await services.getSourceStatus();
        const cluster = await services.getQuestionCluster(
          request.params.clusterId,
        );

        if (!cluster) {
          const error = new Error("Question cluster not found");
          (error as Error & { statusCode: number }).statusCode = 404;
          throw error;
        }

        return {
          data: cluster,
          meta: buildMeta(sourceStatus),
        };
      },
    );

    app.get(
      "/question-clusters/:clusterId/evidence",
      {
        schema: {
          params: ClusterParamsSchema,
          querystring: EvidenceQuerySchema,
          response: {
            200: createResponseSchema(Type.Array(QuestionEvidenceSchema)),
            400: ErrorResponseSchema,
          },
        },
      },
      async (request) => {
        const sourceStatus = await services.getSourceStatus();
        const data = await services.getQuestionEvidence(
          request.params.clusterId,
          request.query.limit,
        );
        return {
          data,
          meta: buildMeta(sourceStatus),
        };
      },
    );
  };
}
