import { loadConfig } from "@devtrend/config";
import {
  buildQuestionPressurePipeline,
  entitySeeds,
  topicSeeds,
  watchlistSeeds,
} from "@devtrend/domain";
import { normalizedDemoItems, sourceCommands } from "@devtrend/sources";
import { createPool, withTransaction } from "./client.js";
import {
  insertPipelineOutput,
  insertSourceStatus,
  resetSeedTables,
  upsertCatalog,
  upsertWatchlists,
} from "./repository.js";

async function main() {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);

  try {
    const sourceStatus = {
      stackoverflow: {
        status: "healthy",
        lastSuccessAt: new Date().toISOString(),
      },
      hackernews: {
        status: "healthy",
        lastSuccessAt: new Date().toISOString(),
      },
      devto: {
        status: "healthy",
        lastSuccessAt: new Date().toISOString(),
      },
      ossinsight: {
        status: "healthy",
        lastSuccessAt: new Date().toISOString(),
      },
    } as const;

    const items = normalizedDemoItems(sourceCommands);
    const pipeline = buildQuestionPressurePipeline(items, sourceStatus);

    await withTransaction(pool, async (client) => {
      await resetSeedTables(client);
      await upsertCatalog(client, topicSeeds, entitySeeds);
      await upsertWatchlists(client, watchlistSeeds);
      await insertSourceStatus(client, sourceStatus);
      await insertPipelineOutput(client, pipeline, sourceStatus);
    });

    process.stdout.write(
      `seeded ${pipeline.feed.length} items and ${pipeline.signals.length} signals\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
