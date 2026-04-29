import {
  getQuestionCluster,
  getQuestionEvidence,
  getSourceStatusMap,
  listFeed,
  listQuestionPressureSignals,
  pingDatabase,
} from "@devtrend/db";
import type { FastifyInstance } from "fastify";
import type { ReadServices } from "./types.js";

function cacheKey(prefix: string, value: object): string {
  return `devtrend:${prefix}:${JSON.stringify(value)}`;
}

async function withCache<T>(
  app: FastifyInstance,
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await app.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {}

  const value = await factory();

  try {
    const ttl = app.config.CACHE_TTL_MINUTES * 60;
    await app.redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch {}

  return value;
}

export function createDatabaseServices(app: FastifyInstance): ReadServices {
  return {
    checkHealth: async () => pingDatabase(app.pg),
    checkReadiness: async () => pingDatabase(app.pg),
    getSourceStatus: async () =>
      withCache(app, "source-status", () => getSourceStatusMap(app.pg)),
    getFeed: async (query) =>
      withCache(app, cacheKey("feed", query), () => listFeed(app.pg, query)),
    getQuestionPressure: async (query) =>
      withCache(app, cacheKey("question-pressure", query), () =>
        listQuestionPressureSignals(app.pg, query),
      ),
    getQuestionCluster: async (clusterId) =>
      withCache(app, cacheKey("cluster", { clusterId }), () =>
        getQuestionCluster(app.pg, clusterId),
      ),
    getQuestionEvidence: async (clusterId, limit) =>
      withCache(app, cacheKey("evidence", { clusterId, limit }), () =>
        getQuestionEvidence(app.pg, clusterId, limit),
      ),
  };
}
