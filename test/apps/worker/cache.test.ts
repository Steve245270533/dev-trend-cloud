import assert from "node:assert/strict";
import test from "node:test";
import { invalidateApiReadCaches } from "../../../apps/worker/src/services/cache.js";

interface FakeCache {
  keys: string[];
  deleted: string[];
}

function createFakeCache(initialKeys: string[]) {
  const state: FakeCache = {
    keys: [...initialKeys],
    deleted: [],
  };

  return {
    state,
    cache: {
      async scan(
        cursor: string,
        _matchToken: "MATCH",
        pattern: string,
        _countToken: "COUNT",
        _count: string,
      ): Promise<[string, string[]]> {
        const regex = new RegExp(
          `^${pattern.replaceAll(/[-/\\^$+?.()|[\]{}]/g, "\\$&").replaceAll("*", ".*")}$`,
        );

        const matches = state.keys.filter((key) => regex.test(key));
        if (cursor !== "0") {
          return ["0", []];
        }

        return ["0", matches];
      },
      async del(...keys: string[]): Promise<number> {
        state.deleted.push(...keys);
        state.keys = state.keys.filter((key) => !keys.includes(key));
        return keys.length;
      },
    },
  };
}

test("invalidateApiReadCaches clears question pressure and cluster caches", async () => {
  const { cache, state } = createFakeCache([
    'devtrend:api:feed:{"limit":20}',
    'devtrend:api:question-pressure:{"limit":20}',
    'devtrend:api:cluster:{"clusterId":"foo"}',
    'devtrend:api:evidence:{"clusterId":"foo","limit":20}',
    "devtrend:api:source-status",
    'devtrend:feed:{"limit":20}',
    'devtrend:question-pressure:{"limit":20}',
    'devtrend:cluster:{"clusterId":"foo"}',
    'devtrend:evidence:{"clusterId":"foo","limit":20}',
    "devtrend:source-status",
    "source-status",
    "devtrend:cluster:meta",
  ]);

  const deleted = await invalidateApiReadCaches(cache);

  assert.equal(deleted, 11);
  assert.deepEqual(
    state.deleted.sort(),
    [
      'devtrend:api:feed:{"limit":20}',
      'devtrend:api:question-pressure:{"limit":20}',
      'devtrend:api:cluster:{"clusterId":"foo"}',
      'devtrend:api:evidence:{"clusterId":"foo","limit":20}',
      "devtrend:api:source-status",
      'devtrend:feed:{"limit":20}',
      'devtrend:question-pressure:{"limit":20}',
      'devtrend:cluster:{"clusterId":"foo"}',
      'devtrend:evidence:{"clusterId":"foo","limit":20}',
      "devtrend:source-status",
      "source-status",
    ].sort(),
  );
  assert.deepEqual(state.keys, ["devtrend:cluster:meta"]);
});

test("invalidateApiReadCaches is a no-op when no matching keys exist", async () => {
  const { cache, state } = createFakeCache(['devtrend:other:{"limit":20}']);

  const deleted = await invalidateApiReadCaches(cache);

  assert.equal(deleted, 0);
  assert.deepEqual(state.deleted, []);
  assert.deepEqual(state.keys, ['devtrend:other:{"limit":20}']);
});
