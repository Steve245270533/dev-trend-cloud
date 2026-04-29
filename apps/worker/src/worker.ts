import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "@devtrend/config";
import type { SourceKey } from "@devtrend/contracts";
import { createPool } from "@devtrend/db";
import { collectLiveSourcePayloads } from "@devtrend/sources";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { QUEUES } from "./jobs/definitions.js";
import { invalidateApiReadCaches } from "./services/cache.js";
import { persistCollectedPayloads } from "./services/pipeline.js";

const config = loadConfig();
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const pool = createPool(config.DATABASE_URL);

const contractAuditQueue = new Queue(QUEUES.contractAudit, {
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

async function bootSchedulers() {
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
  }
}

new Worker(
  QUEUES.contractAudit,
  async (job) => {
    const source = job.data.source as SourceKey | undefined;
    const payloads = await collectLiveSourcePayloads(
      config.OPENCLI_BIN,
      config.OPENCLI_TIMEOUT_MS,
      source ? [source] : undefined,
    );
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
    return { audited: payloads.length };
  },
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.collect,
  async (job) => {
    const source = job.data.source as SourceKey | undefined;
    const payloads = await collectLiveSourcePayloads(
      config.OPENCLI_BIN,
      config.OPENCLI_TIMEOUT_MS,
      source ? [source] : undefined,
    );
    await normalizeQueue.add("normalize", { payloads, source });
    return { collected: payloads.length };
  },
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.normalize,
  async (job) => {
    await matchQueue.add("match", job.data);
    return { normalized: job.data.payloads.length };
  },
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.match,
  async (job) => {
    await clusterQueue.add("cluster", job.data);
    return { matched: job.data.payloads.length };
  },
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.cluster,
  async (job) => {
    await scoreQueue.add("score", job.data);
    return { clustered: job.data.payloads.length };
  },
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

new Worker(
  QUEUES.score,
  async (job) => {
    const result = await persistCollectedPayloads(pool, job.data.payloads);
    await invalidateApiReadCaches(redis);
    return result;
  },
  { connection: redis, prefix: config.QUEUE_PREFIX },
);

await bootSchedulers();
process.stdout.write("worker booted\n");
