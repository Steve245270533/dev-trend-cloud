import { loadConfig } from "@devtrend/config";
import { createPool } from "@devtrend/db";
import { Redis } from "ioredis";

interface PublicTableRow {
  schemaname: string;
  tablename: string;
}

function escapePgIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function truncatePublicTables(databaseUrl: string): Promise<number> {
  const pool = createPool(databaseUrl);

  try {
    const result = await pool.query<PublicTableRow>(
      `
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `,
    );

    if (result.rows.length === 0) {
      return 0;
    }

    const tableList = result.rows
      .map((row) => {
        const schemaName = escapePgIdentifier(row.schemaname);
        const tableName = escapePgIdentifier(row.tablename);
        return `${schemaName}.${tableName}`;
      })
      .join(", ");

    await pool.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

    return result.rows.length;
  } finally {
    await pool.end();
  }
}

async function flushRedisDatabase(redisUrl: string): Promise<void> {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  try {
    await redis.connect();
    await redis.flushdb();
  } finally {
    if (redis.status === "end") {
      redis.disconnect();
    } else {
      await redis.quit();
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const truncatedTableCount = await truncatePublicTables(config.DATABASE_URL);
  await flushRedisDatabase(config.REDIS_URL);

  process.stdout.write(
    `db:reset completed: truncated ${truncatedTableCount} Postgres public tables and flushed the configured Redis database\n`,
  );
}

await main();
