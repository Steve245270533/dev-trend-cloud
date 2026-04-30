import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "@devtrend/config";
import { createPool } from "./client.js";

export async function runMigrations(databaseUrl: string): Promise<string[]> {
  const pool = createPool(databaseUrl);
  const appliedFiles: string[] = [];
  const migrationsDir = resolve(process.cwd(), "packages/db/migrations");

  try {
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = await readFile(resolve(migrationsDir, file), "utf8");
      await pool.query(sql);
      appliedFiles.push(file);
    }

    return appliedFiles;
  } finally {
    await pool.end();
  }
}

async function main() {
  const config = loadConfig();
  const appliedFiles = await runMigrations(config.DATABASE_URL);

  for (const file of appliedFiles) {
    process.stdout.write(`applied ${file}\n`);
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
