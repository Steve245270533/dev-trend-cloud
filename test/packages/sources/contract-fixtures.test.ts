import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(process.cwd(), "..");
const registryPath = resolve(
  repoRoot,
  "packages/sources/src/fixtures/opencli-registry.yaml",
);
const helpPaths = [
  "packages/sources/src/fixtures/helps/stackoverflow-hot.txt",
  "packages/sources/src/fixtures/helps/hackernews-ask.txt",
  "packages/sources/src/fixtures/helps/devto-top.txt",
  "packages/sources/src/fixtures/helps/ossinsight-trending.txt",
];
const samplePaths = [
  "packages/sources/src/fixtures/samples/stackoverflow-hot.json",
  "packages/sources/src/fixtures/samples/hackernews-ask.json",
  "packages/sources/src/fixtures/samples/devto-top.json",
  "packages/sources/src/fixtures/samples/ossinsight-trending.json",
];

test("contract fixtures exist and are non-empty", async () => {
  const registry = await readFile(registryPath, "utf8");
  assert.ok(registry.includes("stackoverflow"));
  assert.ok(registry.includes("ossinsight"));

  for (const relativePath of helpPaths) {
    const content = await readFile(resolve(repoRoot, relativePath), "utf8");
    assert.ok(content.length > 0);
  }

  for (const relativePath of samplePaths) {
    const content = await readFile(resolve(repoRoot, relativePath), "utf8");
    assert.ok(content.length > 0);
    assert.doesNotThrow(() => JSON.parse(content));
  }
});
