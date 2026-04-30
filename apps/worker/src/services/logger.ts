import { resolve } from "node:path";
import pino from "pino";

export type WorkerLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";

export interface WorkerLogger {
  info(event: string, context?: Record<string, unknown>): Promise<void>;
  warn(event: string, context?: Record<string, unknown>): Promise<void>;
  error(event: string, context?: Record<string, unknown>): Promise<void>;
  child(context: Record<string, unknown>): WorkerLogger;
}

type WorkerLogWriteLevel = "info" | "warn" | "error";

interface CreateWorkerLoggerOptions {
  level?: WorkerLogLevel;
  rootDir?: string;
  now?: () => Date;
}

function createNoopLogger(): WorkerLogger {
  return {
    async info() {},
    async warn() {},
    async error() {},
    child() {
      return createNoopLogger();
    },
  };
}

export function createWorkerLogger(
  options: CreateWorkerLoggerOptions = {},
): WorkerLogger {
  const level = options.level ?? "info";
  const now = options.now ?? (() => new Date());
  const rootDir = options.rootDir ?? process.cwd();
  const logFilePath = resolve(rootDir, "logs", "worker.log");

  const transport = pino.transport({
    target: "pino-roll",
    options: {
      file: logFilePath,
      mkdir: true,
      frequency: "daily",
      size: "20m",
      limit: {
        count: 14,
      },
      dateFormat: "yyyy-MM-dd",
      symlink: true,
    },
  });

  const pinoLogger = pino(
    {
      level,
      base: undefined,
      messageKey: "event",
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: () => `,"timestamp":"${now().toISOString()}"`,
    },
    transport,
  );

  async function write(
    logLevel: WorkerLogWriteLevel,
    event: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    if (logLevel === "info") {
      pinoLogger.info({ context }, event);
      return;
    }

    if (logLevel === "warn") {
      pinoLogger.warn({ context }, event);
      return;
    }

    pinoLogger.error({ context }, event);
  }

  function createScopedLogger(
    baseContext: Record<string, unknown>,
  ): WorkerLogger {
    return {
      async info(event, context = {}) {
        await write("info", event, { ...baseContext, ...context });
      },
      async warn(event, context = {}) {
        await write("warn", event, { ...baseContext, ...context });
      },
      async error(event, context = {}) {
        await write("error", event, { ...baseContext, ...context });
      },
      child(context) {
        return createScopedLogger({ ...baseContext, ...context });
      },
    };
  }

  return createScopedLogger({});
}

export function noopWorkerLogger(): WorkerLogger {
  return createNoopLogger();
}
