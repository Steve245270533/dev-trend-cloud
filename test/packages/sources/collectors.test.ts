import assert from "node:assert/strict";
import test from "node:test";
import { resolveSourceCommandArgv, sourceCommands } from "@devtrend/sources";

const collectionReposCommand = sourceCommands.find(
  (command) =>
    command.source === "ossinsight" && command.name === "collection-repos",
);
const collectionIssuesCommand = sourceCommands.find(
  (command) =>
    command.source === "ossinsight" && command.name === "collection-issues",
);

test("resolveSourceCommandArgv turns OSSInsight collection targets into numeric ids", async () => {
  assert.ok(collectionReposCommand);

  const argv = await resolveSourceCommandArgv(
    collectionReposCommand,
    "opencli",
    1000,
    new Map<string, string>(),
    async (_bin, argv) => {
      if (argv[1] === "collections") {
        return [{ id: "10004", name: "Web Framework" }];
      }

      if (argv[1] === "hot-collections") {
        return [];
      }

      throw new Error(`unexpected argv: ${argv.join(" ")}`);
    },
  );

  assert.deepEqual(argv, [
    "ossinsight",
    "collection-repos",
    "10004",
    "--limit",
    "5",
    "-f",
    "json",
  ]);
});

test("resolveSourceCommandArgv fails clearly when a collection id cannot be found", async () => {
  assert.ok(collectionReposCommand);

  await assert.rejects(
    resolveSourceCommandArgv(
      collectionReposCommand,
      "opencli",
      1000,
      new Map<string, string>(),
      async () => [],
    ),
    /Unable to resolve OSSInsight collection id for Web Framework/,
  );
});

test("resolveSourceCommandArgv reuses cached collection ids across commands", async () => {
  assert.ok(collectionReposCommand);
  assert.ok(collectionIssuesCommand);
  const cache = new Map<string, string>();
  let collectionLookups = 0;

  const runJson = async (_bin: string, argv: string[]) => {
    if (argv[1] === "collections" || argv[1] === "hot-collections") {
      collectionLookups += 1;
    }

    if (argv[1] === "collections") {
      return [{ id: "10004", name: "Web Framework" }];
    }

    if (argv[1] === "hot-collections") {
      return [];
    }

    throw new Error(`unexpected argv: ${argv.join(" ")}`);
  };

  const reposArgv = await resolveSourceCommandArgv(
    collectionReposCommand,
    "opencli",
    1000,
    cache,
    runJson,
  );
  const issuesArgv = await resolveSourceCommandArgv(
    collectionIssuesCommand,
    "opencli",
    1000,
    cache,
    runJson,
  );

  assert.equal(reposArgv[2], "10004");
  assert.equal(issuesArgv[2], "10004");
  assert.equal(collectionLookups, 2);
});
