import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "@devtrend/config";
import type { SourceKey } from "@devtrend/contracts";
import { createPool, getWorkerBootstrapState } from "@devtrend/db";
import { collectLiveSourcePayloads } from "@devtrend/sources";
import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { QUEUES } from "./jobs/definitions.js";
import { invalidateApiReadCaches } from "./services/cache.js";
import { createWorkerLogger, type WorkerLogger } from "./services/logger.js";
import {
  loadRuntimeTopics,
  persistCollectedPayloads,
  planWorkerBootstrap,
  refreshRuntimeTopicSeeds,
} from "./services/pipeline.js";

const config = loadConfig();
const logger = createWorkerLogger({ level: config.LOG_LEVEL });
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const pool = createPool(config.DATABASE_URL);

const contractAuditQueue = new Queue(QUEUES.contractAudit, {
  connection: redis,
  prefix: config.QUEUE_PREFIX,
});
const topicSeedRefreshQueue = new Queue(QUEUES.topicSeedRefresh, {
  connection: redis,
  prefix: config.QUEUE_PREFIX,
});
const collectQueue = new Queue(QUEUES.collect, {
  connection: redis,
  prefix: config.QUEUE_PREFIX,
});
const normalizeQueue = new Queue(QUEUES.normalize, {
  connection: redis,
  prefix: config.QUEUE_PREFIX,
});
const matchQueue = new Queue(QUEUES.match, {
  connection: redis,
  prefix: config.QUEUE_PREFIX,
});
const clusterQueue = new Queue(QUEUES.cluster, {
  connection: redis,
  prefix: config.QUEUE_PREFIX,
});
const scoreQueue = new Queue(QUEUES.score, {
  connection: redis,
  prefix: config.QUEUE_PREFIX,
});

const sourcePollCrons: Record<SourceKey, string> = {
  stackoverflow: config.SOURCE_POLL_SO_CRON,
  hackernews: config.SOURCE_POLL_HN_CRON,
  devto: config.SOURCE_POLL_DEVTO_CRON,
  ossinsight: config.SOURCE_POLL_OSSINSIGHT_CRON,
};

function toErrorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    name: "Error",
    message: String(error),
    stack: null,
  };
}

function toNumericCounts(result: unknown): Record<string, number> {
  if (!result || typeof result !== "object") {
    return {};
  }

  return Object.entries(result).reduce<Record<string, number>>(
    (accumulator, [key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        accumulator[key] = value;
      }
      return accumulator;
    },
    {},
  );
}

function buildJobLogger(queue: string, job: Job): WorkerLogger {
  const context: Record<string, unknown> = {
    queue,
    jobName: job.name,
    jobId: job.id ?? null,
    attemptsMade: job.attemptsMade,
  };

  if (
    job.data &&
    typeof job.data === "object" &&
    "source" in job.data &&
    typeof (job.data as { source?: unknown }).source === "string"
  ) {
    context.source = (job.data as { source: string }).source;
  }

  if (
    job.data &&
    typeof job.data === "object" &&
    "bootstrap" in job.data &&
    typeof (job.data as { bootstrap?: unknown }).bootstrap === "boolean"
  ) {
    context.bootstrap = (job.data as { bootstrap: boolean }).bootstrap;
  }

  return logger.child(context);
}

async function runJobWithLogging<T>(
  queue: string,
  job: Job,
  run: (jobLogger: WorkerLogger) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const jobLogger = buildJobLogger(queue, job);
  await jobLogger.info("job.start");

  try {
    const result = await run(jobLogger);
    await jobLogger.info("job.success", {
      durationMs: Date.now() - startedAt,
      counts: toNumericCounts(result),
    });
    return result;
  } catch (error) {
    await jobLogger.error("job.fail", {
      durationMs: Date.now() - startedAt,
      error: toErrorContext(error),
    });
    throw error;
  }
}

async function bootSchedulers() {
  await topicSeedRefreshQueue.add(
    "topic-seed-refresh",
    {},
    {
      repeat: {
        pattern: config.TOPIC_SEED_REFRESH_CRON,
      },
      jobId: "topic-seed-refresh-repeat",
    },
  );
  await logger.info("worker.scheduler.registered", {
    queue: QUEUES.topicSeedRefresh,
    jobId: "topic-seed-refresh-repeat",
    cron: config.TOPIC_SEED_REFRESH_CRON,
  });

  for (const [source, pattern] of Object.entries(sourcePollCrons) as [
    SourceKey,
    string,
  ][]) {
    await contractAuditQueue.add(
      "contract-audit",
      { source },
      {
        repeat: {
          pattern,
        },
        jobId: `contract-audit-repeat:${source}`,
      },
    );
    await logger.info("worker.scheduler.registered", {
      queue: QUEUES.contractAudit,
      source,
      jobId: `contract-audit-repeat:${source}`,
      cron: pattern,
    });

    await collectQueue.add(
      "collect",
      { source },
      {
        repeat: {
          pattern,
        },
        jobId: `collect-repeat:${source}`,
      },
    );
    await logger.info("worker.scheduler.registered", {
      queue: QUEUES.collect,
      source,
      jobId: `collect-repeat:${source}`,
      cron: pattern,
    });
  }
}

async function bootstrapQueues() {
  const state = await getWorkerBootstrapState(pool);
  const plan = planWorkerBootstrap(
    state,
    Object.keys(sourcePollCrons) as SourceKey[],
  );
  const scheduled: string[] = [];

  await logger.info("worker.bootstrap.plan", {
    state,
    refreshRuntimeTopics: plan.refreshRuntimeTopics,
    collectSources: plan.collectSources,
  });

  if (plan.refreshRuntimeTopics) {
    await topicSeedRefreshQueue.add(
      "topic-seed-refresh",
      { bootstrap: true },
      {
        jobId: "bootstrap-topic-seed-refresh",
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    scheduled.push("topic-seed-refresh");
  }

  for (const source of plan.collectSources) {
    await collectQueue.add(
      "collect",
      { source, bootstrap: true },
      {
        jobId: `bootstrap-collect-${source}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    scheduled.push(`collect:${source}`);
  }

  await logger.info("worker.bootstrap.enqueued", {
    scheduled,
    count: scheduled.length,
  });
}

new Worker(
  QUEUES.topicSeedRefresh,
  async (job) =>
    runJobWithLogging(QUEUES.topicSeedRefresh, job, async (jobLogger) =>
      refreshRuntimeTopicSeeds(
        pool,
        config.OPENCLI_BIN,
        config.OPENCLI_TIMEOUT_MS,
        undefined,
        jobLogger.child({ stage: "topic-seed-refresh" }),
      ),
    ),
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.contractAudit,
  async (job) =>
    runJobWithLogging(QUEUES.contractAudit, job, async (jobLogger) => {
      const source = job.data.source as SourceKey | undefined;
      const payloads = await collectLiveSourcePayloads({
        openCliBin: config.OPENCLI_BIN,
        timeoutMs: config.OPENCLI_TIMEOUT_MS,
        sources: source ? [source] : undefined,
        mode: "audit",
      });
      const outputDir = resolve(process.cwd(), "docs/reports/contract-audit");
      await mkdir(outputDir, { recursive: true });
      await writeFile(
        resolve(
          outputDir,
          source ? `worker-${source}-latest.json` : "worker-latest.json",
        ),
        JSON.stringify(payloads, null, 2),
        "utf8",
      );
      await jobLogger.info("worker.contract-audit.report.written", {
        source: source ?? null,
        payloadCount: payloads.length,
      });
      return { audited: payloads.length };
    }),
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.collect,
  async (job) =>
    runJobWithLogging(QUEUES.collect, job, async (jobLogger) => {
      const source = job.data.source as SourceKey | undefined;
      const runtimeTopics = await loadRuntimeTopics(pool);
      await jobLogger.info("pipeline.collect.runtime-topics.loaded", {
        runtimeTopicCount: runtimeTopics.length,
      });

      const payloads = await collectLiveSourcePayloads({
        openCliBin: config.OPENCLI_BIN,
        timeoutMs: config.OPENCLI_TIMEOUT_MS,
        sources: source ? [source] : undefined,
        runtimeTopics,
      });
      await jobLogger.info("pipeline.collect.payloads.collected", {
        source: source ?? null,
        payloadCount: payloads.length,
      });

      await normalizeQueue.add("normalize", { payloads, source });
      await jobLogger.info("pipeline.collect.enqueue.normalize", {
        payloadCount: payloads.length,
      });

      return { collected: payloads.length };
    }),
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.normalize,
  async (job) =>
    runJobWithLogging(QUEUES.normalize, job, async (jobLogger) => {
      await matchQueue.add("match", job.data);
      const normalizedCount = Array.isArray(job.data.payloads)
        ? job.data.payloads.length
        : 0;
      await jobLogger.info("pipeline.normalize.enqueue.match", {
        normalizedCount,
      });
      return { normalized: normalizedCount };
    }),
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.match,
  async (job) =>
    runJobWithLogging(QUEUES.match, job, async (jobLogger) => {
      await clusterQueue.add("cluster", job.data);
      const matchedCount = Array.isArray(job.data.payloads)
        ? job.data.payloads.length
        : 0;
      await jobLogger.info("pipeline.match.enqueue.cluster", {
        matchedCount,
      });
      return { matched: matchedCount };
    }),
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.cluster,
  async (job) =>
    runJobWithLogging(QUEUES.cluster, job, async (jobLogger) => {
      await scoreQueue.add("score", job.data);
      const clusteredCount = Array.isArray(job.data.payloads)
        ? job.data.payloads.length
        : 0;
      await jobLogger.info("pipeline.cluster.enqueue.score", {
        clusteredCount,
      });
      return { clustered: clusteredCount };
    }),
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.score,
  async (job) =>
    runJobWithLogging(QUEUES.score, job, async (jobLogger) => {
      const payloads = Array.isArray(job.data.payloads)
        ? job.data.payloads
        : [];
      await jobLogger.info("pipeline.score.persist.pg.start", {
        payloadCount: payloads.length,
      });
      const result = await persistCollectedPayloads(
        pool,
        payloads,
        jobLogger.child({ stage: "persist.pg" }),
      );
      await jobLogger.info("pipeline.score.persist.pg.done", {
        items: result.items,
        signals: result.signals,
      });

      await jobLogger.info("redis.cache.invalidate.start");
      const deleted = await invalidateApiReadCaches(redis);
      await jobLogger.info("redis.cache.invalidate.done", {
        deleted,
      });
      return result;
    }),
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

await logger.info("worker.boot.start", {
  queuePrefix: config.QUEUE_PREFIX,
  sourcePollCrons,
  topicSeedRefreshCron: config.TOPIC_SEED_REFRESH_CRON,
});

try {
  await bootSchedulers();
} catch (error) {
  await logger.error("worker.scheduler.register.failed", {
    error: toErrorContext(error),
  });
  throw error;
}

try {
  await bootstrapQueues();
} catch (error) {
  await logger.error("worker.bootstrap.failed", {
    error: toErrorContext(error),
  });
  throw error;
}

await logger.info("worker.boot.done");
