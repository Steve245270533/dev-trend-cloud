import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient, QueryResult } from "pg";
import { persistCollectedPayloads } from "../../../apps/worker/src/services/pipeline.js";

test("persistCollectedPayloads rolls back the transaction on replacement failure", async () => {
  const executed: string[] = [];
  const client = {
    async query(text: string) {
      executed.push(text);

      if (text.includes("INSERT INTO source_health")) {
        throw new Error("write failed");
      }

      return { rows: [] } as unknown as QueryResult;
    },
    release() {},
  } as unknown as PoolClient;

  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;

  await assert.rejects(
    persistCollectedPayloads(pool, [
      {
        source: "stackoverflow",
        commandName: "hot",
        argv: ["stackoverflow", "hot", "--limit", "5", "-f", "json"],
        helpOutput: "usage",
        payload: [
          {
            title: "How do I debug Model Context Protocol tool registration?",
            score: 12,
            answers: 0,
            url: "https://stackoverflow.com/questions/10000001/mcp-fastify-tool-registration",
          },
        ],
      },
    ]),
  );

  assert.ok(executed.includes("BEGIN"));
  assert.ok(executed.some((text) => text.includes("TRUNCATE TABLE")));
  assert.ok(executed.includes("ROLLBACK"));
  assert.ok(!executed.includes("COMMIT"));
});
