import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({
    host: app.config.HOST,
    port: app.config.PORT,
  });
} catch (error) {
  const failure = error instanceof Error ? error : new Error(String(error));
  app.log.error(failure);
  process.exit(1);
}
