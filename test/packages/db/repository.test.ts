import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import {
  listFeed,
  listQuestionPressureSignals,
} from "../../../packages/db/src/repository.js";

test("listFeed pushes topic and entity filters into SQL before LIMIT", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  await listFeed(db, {
    topic: "mcp",
    entity: "fastify",
    source: "stackoverflow",
    limit: 5,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /EXISTS\s*\(\s*SELECT 1\s*FROM item_topics/);
  assert.match(calls[0].text, /EXISTS\s*\(\s*SELECT 1\s*FROM item_entities/);
  assert.deepEqual(calls[0].params, ["stackoverflow", "mcp", "fastify", 5]);
});

test("listQuestionPressureSignals filters in SQL before LIMIT", async () => {
  const calls: { text: string; params?: unknown[] }[] = [];
  const db = {
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows: [] } as unknown as QueryResult;
    },
  };

  await listQuestionPressureSignals(db, {
    topic: "mcp",
    entity: "fastify",
    limit: 10,
  });

  assert.equal(calls.length, 1);
  assert.match(
    calls[0].text,
    /JOIN question_clusters qc ON qc\.id = s\.cluster_id/,
  );
  assert.match(calls[0].text, /\$1 = ANY\(qc\.affected_topics\)/);
  assert.match(calls[0].text, /\$2 = ANY\(qc\.affected_entities\)/);
  assert.deepEqual(calls[0].params, ["mcp", "fastify", 10]);
});
