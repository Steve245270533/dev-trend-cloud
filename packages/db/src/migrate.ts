import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../../config/src/index.js";
import { createPool } from "./client.js";

async function main() {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  const migrationsDir = resolve(process.cwd(), "packages/db/migrations");

  try {
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = await readFile(resolve(migrationsDir, file), "utf8");
      await pool.query(sql);
      process.stdout.write(`applied ${file}\n`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
