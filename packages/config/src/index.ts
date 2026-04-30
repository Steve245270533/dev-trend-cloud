import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type Static, Type } from "@sinclair/typebox";
import envSchema from "env-schema";

export const AppConfigSchema = Type.Object({
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: "0.0.0.0" }),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal("trace"),
      Type.Literal("debug"),
      Type.Literal("info"),
      Type.Literal("warn"),
      Type.Literal("error"),
      Type.Literal("fatal"),
    ],
    { default: "info" },
  ),
  DATABASE_URL: Type.String(),
  REDIS_URL: Type.String(),
  OPENCLI_BIN: Type.String({ default: "opencli" }),
  OPENCLI_TIMEOUT_MS: Type.Number({ default: 20000 }),
  CACHE_TTL_MINUTES: Type.Number({ default: 15 }),
  QUEUE_PREFIX: Type.String({ default: "devtrend" }),
  SOURCE_POLL_SO_CRON: Type.String({ default: "*/20 * * * *" }),
  SOURCE_POLL_HN_CRON: Type.String({ default: "*/20 * * * *" }),
  SOURCE_POLL_DEVTO_CRON: Type.String({ default: "*/30 * * * *" }),
  SOURCE_POLL_OSSINSIGHT_CRON: Type.String({ default: "*/30 * * * *" }),
  TOPIC_SEED_REFRESH_CRON: Type.String({ default: "0 * * * *" }),
});

export type AppConfig = Static<typeof AppConfigSchema>;

const DEFAULT_NODE_ENV = "development";

function parseDotEnv(content: string): Record<string, string> {
  return content
    .split(/\r?\n/)
    .reduce<Record<string, string>>((accumulator, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      accumulator[key] = value;
      return accumulator;
    }, {});
}

function getNodeEnv(data: Record<string, string | undefined>): string {
  return data.NODE_ENV?.trim() || DEFAULT_NODE_ENV;
}

function buildEnvFilenames(nodeEnv: string): string[] {
  const filenames = [".env"];

  if (nodeEnv) {
    filenames.push(`.env.${nodeEnv}`);
  }

  if (nodeEnv !== "test") {
    filenames.push(".env.local");
  }

  if (nodeEnv) {
    filenames.push(`.env.${nodeEnv}.local`);
  }

  return filenames;
}

function findNearestEnvDir(
  filenames: string[],
  startDir = process.cwd(),
): string | null {
  let currentDir = resolve(startDir);

  while (true) {
    if (
      filenames.some((filename) => existsSync(resolve(currentDir, filename)))
    ) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  return parseDotEnv(readFileSync(filePath, "utf8"));
}

function loadEnvFiles(
  data: Record<string, string | undefined>,
  startDir = process.cwd(),
): Record<string, string> {
  const explicitEnvFile = data.ENV_FILE?.trim();

  if (explicitEnvFile) {
    return loadEnvFile(resolve(startDir, explicitEnvFile));
  }

  const filenames = buildEnvFilenames(getNodeEnv(data));
  const envDir = findNearestEnvDir(filenames, startDir);

  if (envDir === null) {
    return {};
  }

  return filenames.reduce<Record<string, string>>((accumulator, filename) => {
    Object.assign(accumulator, loadEnvFile(resolve(envDir, filename)));
    return accumulator;
  }, {});
}

export function loadConfig(
  data: Record<string, string | undefined> = process.env,
): AppConfig {
  return envSchema<AppConfig>({
    data: {
      ...loadEnvFiles(data),
      ...data,
    },
    schema: AppConfigSchema,
  });
}
