import assert from "node:assert/strict";
import test from "node:test";
import {
  collectLiveSourcePayloads,
  discoverRuntimeTopicCandidates,
  mergeRuntimeTopicCandidates,
  resolveSourceCommandArgv,
  sourceCommands,
} from "@devtrend/sources";

interface TestRuntimeTopicSeed {
  runId: string;
  slug: string;
  name: string;
  keywords: string[];
  sourcePriority: number;
  sources: (
    | "ossinsight-hot"
    | "ossinsight-collections"
    | "devto-top"
    | "fallback-topics"
  )[];
  collectionId?: string;
  devtoTags: string[];
  score: number;
  active: boolean;
  refreshedAt: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
}

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

test("discoverRuntimeTopicCandidates extracts OSSInsight collections and safe DEV tags", async () => {
  const discovery = await discoverRuntimeTopicCandidates(
    "opencli",
    1000,
    async (_bin, argv) => {
      if (argv[1] === "hot-collections") {
        return [
          {
            id: "10010",
            name: "Artificial Intelligence",
            repo_name: "huggingface/transformers",
            rank_change: "4",
          },
        ];
      }

      if (argv[1] === "collections") {
        return [
          { id: "10005", name: "Javascript Framework" },
          { id: "10013", name: "Game Engine" },
        ];
      }

      if (argv[0] === "devto" && argv[1] === "top") {
        return [{ tags: "ai,agents,travel" }];
      }

      throw new Error(`unexpected argv: ${argv.join(" ")}`);
    },
  );

  assert.equal(discovery.sourceStatuses[0]?.status, "success");
  assert.equal(discovery.sourceStatuses[1]?.status, "success");
  assert.ok(
    discovery.candidates.some(
      (candidate) => candidate.slug === "artificial-intelligence",
    ),
  );
  assert.ok(
    discovery.candidates.some(
      (candidate) => candidate.slug === "javascript-framework",
    ),
  );
  assert.ok(discovery.candidates.some((candidate) => candidate.slug === "ai"));
  assert.equal(
    discovery.candidates.some((candidate) => candidate.slug === "game-engine"),
    false,
  );
  assert.equal(
    discovery.candidates.some((candidate) => candidate.slug === "travel"),
    false,
  );
});

test("mergeRuntimeTopicCandidates keeps fallback topics and upgrades with remote metadata", () => {
  const fallbackTopics: TestRuntimeTopicSeed[] = [
    {
      runId: "00000000-0000-5000-8000-000000000000",
      slug: "mcp",
      name: "Model Context Protocol",
      keywords: ["mcp", "model context protocol"],
      sourcePriority: 10,
      sources: ["fallback-topics"],
      devtoTags: [],
      score: 10,
      active: true,
      refreshedAt: "2026-04-29T00:00:00.000Z",
      expiresAt: "2026-04-29T02:00:00.000Z",
      metadata: {},
    },
  ];

  const merged = mergeRuntimeTopicCandidates(
    [
      {
        slug: "mcp",
        name: "MCP",
        keywords: ["mcp", "protocol"],
        sourcePriority: 100,
        sources: ["ossinsight-hot"],
        score: 100,
        devtoTags: ["mcp"],
        metadata: { collectionId: "10040" },
      },
    ],
    fallbackTopics,
    new Date("2026-04-29T01:00:00.000Z"),
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.name, "MCP");
  assert.ok(merged[0]?.keywords.includes("model context protocol"));
  assert.ok(merged[0]?.sources.includes("fallback-topics"));
  assert.ok(merged[0]?.sources.includes("ossinsight-hot"));
  assert.deepEqual(merged[0]?.devtoTags, ["mcp"]);
});

test("collectLiveSourcePayloads expands runtime topics into source-specific commands", async () => {
  const payloads = await collectLiveSourcePayloads(
    {
      openCliBin: "opencli",
      timeoutMs: 1000,
      sources: ["stackoverflow", "devto", "ossinsight"],
      runtimeTopics: [
        {
          runId: "11111111-1111-5111-8111-111111111111",
          slug: "artificial-intelligence",
          name: "Artificial Intelligence",
          keywords: ["artificial intelligence", "ai"],
          sourcePriority: 100,
          sources: ["ossinsight-hot", "devto-top"],
          collectionId: "10010",
          devtoTags: ["ai"],
          score: 104,
          active: true,
          refreshedAt: "2026-04-29T00:00:00.000Z",
          expiresAt: "2026-04-29T02:00:00.000Z",
          metadata: {},
        },
      ],
      queryBudget: {
        maxTopics: 1,
        maxVariantsPerSourceTopic: 2,
        maxDynamicCommandsPerSource: 4,
      },
    },
    async () => "help",
    async (_bin, argv) => [{ argv: argv.join(" ") }],
  );

  assert.ok(
    payloads.some(
      (payload) =>
        payload.commandName === "search" &&
        payload.source === "stackoverflow" &&
        payload.argv[2] === "Artificial Intelligence" &&
        payload.metadata?.topicSlug === "artificial-intelligence",
    ),
  );
  assert.ok(
    payloads.some(
      (payload) =>
        payload.commandName === "tag" &&
        payload.source === "devto" &&
        payload.argv[2] === "ai" &&
        payload.metadata?.querySource === "ossinsight",
    ),
  );
  assert.ok(
    payloads.some(
      (payload) =>
        payload.commandName === "collection-stars" &&
        payload.source === "ossinsight" &&
        payload.argv[2] === "10010" &&
        payload.metadata?.runtimeTopicSeedRunId ===
          "11111111-1111-5111-8111-111111111111",
    ),
  );
});
