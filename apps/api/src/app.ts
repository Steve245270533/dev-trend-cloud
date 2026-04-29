import { type AppConfig, loadConfig } from "@devtrend/config";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import { configPlugin, dataPlugin } from "./plugins/app-plugins.js";
import { createRoutes } from "./routes/index.js";
import { createDatabaseServices } from "./services/database-services.js";
import type { ReadServices } from "./services/types.js";

export interface BuildAppOptions {
  config?: AppConfig;
  services?: ReadServices;
  registerDataPlugins?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        process.env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
            }
          : undefined,
      redact: ["req.headers.authorization"],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(configPlugin, { config });

  if (options.registerDataPlugins !== false) {
    await app.register(dataPlugin);
  }

  app.setErrorHandler((error, _request, reply) => {
    const failure = error instanceof Error ? error : new Error(String(error));
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? ((error as { statusCode: number }).statusCode ?? 500)
        : 500;
    reply.code(statusCode).send({
      error: failure.name,
      message: failure.message,
      statusCode,
    });
  });

  const services = options.services ?? createDatabaseServices(app);
  await app.register(createRoutes(services));

  return app;
}
