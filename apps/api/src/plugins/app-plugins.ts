import type { AppConfig } from "@devtrend/config";
import fastifyPostgres from "@fastify/postgres";
import fastifyRedis from "@fastify/redis";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export const configPlugin = fp<{ config: AppConfig }>(
  async function configPlugin(fastify, options) {
    fastify.decorate("config", options.config);
  },
);

export const dataPlugin: FastifyPluginAsync = fp(
  async function dataPlugin(fastify) {
    await fastify.register(fastifyPostgres, {
      connectionString: fastify.config.DATABASE_URL,
    });

    await fastify.register(fastifyRedis, {
      url: fastify.config.REDIS_URL,
    });
  },
);
