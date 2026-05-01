import assert from "node:assert/strict";
import test from "node:test";
import type { SourceAdapter } from "@devtrend/sources";
import {
  collectLiveSourcePayloads,
  createSourceAdapterRegistry,
  discoverRuntimeTopicCandidates,
  MemoryCircuitBreakerStore,
  mergeRuntimeTopicCandidates,
  normalizeCollectedPayloads,
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

  const ossInsightDynamicPayloads = payloads.filter(
    (payload) =>
      payload.source === "ossinsight" &&
      payload.commandName.startsWith("collection-"),
  );
  assert.equal(ossInsightDynamicPayloads.length, 4);
  assert.deepEqual(
    [
      ...new Set(
        ossInsightDynamicPayloads.map((payload) => payload.commandName),
      ),
    ]
      .sort()
      .join(","),
    [
      "collection-issues",
      "collection-prs",
      "collection-repos",
      "collection-stars",
    ]
      .sort()
      .join(","),
  );
  assert.ok(
    ossInsightDynamicPayloads.every(
      (payload) => payload.metadata?.topicSlug === "artificial-intelligence",
    ),
  );
});

test("collectLiveSourcePayloads enforces OSSInsight dynamic budget across templates", async () => {
  const payloads = await collectLiveSourcePayloads(
    {
      openCliBin: "opencli",
      timeoutMs: 1000,
      sources: ["ossinsight"],
      runtimeTopics: [
        {
          runId: "11111111-1111-5111-8111-111111111111",
          slug: "topic-a",
          name: "Topic A",
          keywords: ["topic a"],
          sourcePriority: 100,
          sources: ["ossinsight-hot"],
          collectionId: "10010",
          devtoTags: [],
          score: 200,
          active: true,
          refreshedAt: "2026-04-29T00:00:00.000Z",
          expiresAt: "2026-04-29T02:00:00.000Z",
          metadata: {},
        },
        {
          runId: "11111111-1111-5111-8111-111111111111",
          slug: "topic-b",
          name: "Topic B",
          keywords: ["topic b"],
          sourcePriority: 100,
          sources: ["ossinsight-hot"],
          collectionId: "10011",
          devtoTags: [],
          score: 100,
          active: true,
          refreshedAt: "2026-04-29T00:00:00.000Z",
          expiresAt: "2026-04-29T02:00:00.000Z",
          metadata: {},
        },
      ],
      queryBudget: {
        maxTopics: 2,
        maxVariantsPerSourceTopic: 1,
        maxDynamicCommandsPerSource: 4,
      },
    },
    async () => "help",
    async (_bin, argv) => [{ argv: argv.join(" ") }],
  );

  const ossInsightDynamicPayloads = payloads.filter(
    (payload) =>
      payload.source === "ossinsight" &&
      payload.commandName.startsWith("collection-"),
  );
  assert.equal(ossInsightDynamicPayloads.length, 4);
  assert.ok(
    ossInsightDynamicPayloads.every(
      (payload) => payload.metadata?.topicSlug === "topic-a",
    ),
  );
});

test("collectLiveSourcePayloads skips tasks when the circuit breaker is open", async () => {
  const breakerStore = new MemoryCircuitBreakerStore();

  await breakerStore.recordFailure("stackoverflow:feed:hot");
  await breakerStore.recordFailure("stackoverflow:feed:hot");
  await breakerStore.recordFailure("stackoverflow:feed:hot");

  const payloads = await collectLiveSourcePayloads(
    {
      openCliBin: "opencli",
      timeoutMs: 1000,
      sources: ["stackoverflow"],
      breakerStore,
    },
    async () => "help",
    async () => {
      throw new Error("should not execute while breaker is open");
    },
  );

  const hotPayload = payloads.find(
    (payload) =>
      payload.source === "stackoverflow" && payload.commandName === "hot",
  );
  assert.ok(hotPayload);
  assert.equal(hotPayload?.status, "failed");
  assert.equal(hotPayload?.executionDecision, "skipped-open-circuit");
  assert.match(String(hotPayload?.errorText), /Circuit breaker open/);
});

test("collectLiveSourcePayloads closes a half-open breaker after a successful probe", async () => {
  const breakerStore = new MemoryCircuitBreakerStore();

  await breakerStore.recordFailure("stackoverflow:feed:hot");
  await breakerStore.recordFailure("stackoverflow:feed:hot");
  await breakerStore.recordFailure("stackoverflow:feed:hot");
  const current = await breakerStore.get("stackoverflow:feed:hot");
  assert.ok(current);

  breakerStore.states.set("stackoverflow:feed:hot", {
    ...current,
    openedAt: "2026-04-28T00:00:00.000Z",
  });

  await collectLiveSourcePayloads(
    {
      openCliBin: "opencli",
      timeoutMs: 1000,
      sources: ["stackoverflow"],
      breakerStore,
    },
    async () => "help",
    async (_bin, argv) => [{ argv: argv.join(" ") }],
  );

  const next = await breakerStore.get("stackoverflow:feed:hot");
  assert.equal(next?.status, "closed");
  assert.equal(next?.consecutiveFailures, 0);
});

test("collectLiveSourcePayloads audit mode bypasses the circuit breaker", async () => {
  const breakerStore = new MemoryCircuitBreakerStore();

  await breakerStore.recordFailure("stackoverflow:feed:hot");
  await breakerStore.recordFailure("stackoverflow:feed:hot");
  await breakerStore.recordFailure("stackoverflow:feed:hot");

  const payloads = await collectLiveSourcePayloads(
    {
      openCliBin: "opencli",
      timeoutMs: 1000,
      sources: ["stackoverflow"],
      mode: "audit",
      breakerStore,
    },
    async () => "help",
    async (_bin, argv) => [{ argv: argv.join(" ") }],
  );

  assert.ok(
    payloads.some(
      (payload) =>
        payload.source === "stackoverflow" &&
        payload.commandName === "hot" &&
        payload.status === "success",
    ),
  );
});

test("discoverRuntimeTopicCandidates keeps partial discovery results when one OSSInsight command fails", async () => {
  const discovery = await discoverRuntimeTopicCandidates(
    "opencli",
    1000,
    async (_bin, argv) => {
      if (argv[1] === "hot-collections") {
        throw new Error("temporary upstream failure");
      }

      if (argv[1] === "collections") {
        return [{ id: "10005", name: "Javascript Framework" }];
      }

      if (argv[0] === "devto" && argv[1] === "top") {
        return [{ tags: "mcp,travel" }];
      }

      throw new Error(`unexpected argv: ${argv.join(" ")}`);
    },
  );

  assert.ok(
    discovery.candidates.some(
      (candidate) => candidate.slug === "javascript-framework",
    ),
  );
  assert.ok(discovery.candidates.some((candidate) => candidate.slug === "mcp"));
  assert.equal(
    discovery.sourceStatuses.find((status) => status.source === "ossinsight")
      ?.status,
    "success",
  );
});

test("collectLiveSourcePayloads can use a custom adapter registry without collector changes", async () => {
  const fakeAdapter: SourceAdapter = {
    key: "stackoverflow-fake",
    source: "stackoverflow",
    supports: ["feed"],
    buildStaticTasks(_context) {
      return [
        {
          taskKey:
            "stackoverflow-fake:stackoverflow fake-hot --limit 1 -f json",
          source: "stackoverflow",
          capability: "feed",
          commandName: "fake-hot",
          argv: ["stackoverflow", "fake-hot", "--limit", "1", "-f", "json"],
          helpArgv: ["stackoverflow", "fake-hot", "--help"],
          breakerKey: "stackoverflow:feed:fake-hot",
          adapterKey: "stackoverflow-fake",
          routeRole: "primary",
          taskFamily: "fake-hot",
        },
      ];
    },
    buildDynamicTasks(_context) {
      return [];
    },
    normalize(_task, entries) {
      return entries.map((_entry, index) => ({
        id: `fake-${index}`,
        source: "stackoverflow",
        sourceItemId: `fake-${index}`,
        title: "Fake item",
        summary: "",
        url: "",
        publishedAt: "2026-04-29T00:00:00.000Z",
        collectedAt: "2026-04-29T00:00:00.000Z",
        timestampOrigin: "collected",
        score: 0,
        answerCount: 0,
        commentCount: 0,
        tags: [],
        contentType: "fake-hot",
        isQuestion: true,
        rawMeta: {},
      }));
    },
  };

  const payloads = await collectLiveSourcePayloads(
    {
      openCliBin: "opencli",
      timeoutMs: 1000,
      sources: ["stackoverflow"],
      adapterRegistry: createSourceAdapterRegistry([fakeAdapter]),
    },
    async () => "help",
    async (_bin, argv) => [{ argv: argv.join(" ") }],
  );

  assert.deepEqual(
    payloads.map((payload) => payload.commandName),
    ["fake-hot"],
  );
  assert.equal(payloads[0]?.adapterKey, "stackoverflow-fake");
});

test("collectLiveSourcePayloads only runs tasks from the primary route adapter", async () => {
  const primaryAdapter: SourceAdapter = {
    key: "stackoverflow-primary",
    source: "stackoverflow",
    supports: ["feed"],
    buildStaticTasks() {
      return [
        {
          taskKey: "stackoverflow-primary:stackoverflow primary-hot -f json",
          source: "stackoverflow",
          capability: "feed",
          commandName: "primary-hot",
          argv: ["stackoverflow", "primary-hot", "-f", "json"],
          helpArgv: ["stackoverflow", "primary-hot", "--help"],
          breakerKey: "stackoverflow:feed:hot",
          adapterKey: "stackoverflow-primary",
          routeRole: "primary",
          taskFamily: "hot",
        },
      ];
    },
    buildDynamicTasks() {
      return [];
    },
    normalize() {
      return [];
    },
  };

  const backupAdapter: SourceAdapter = {
    key: "stackoverflow-backup",
    source: "stackoverflow",
    supports: ["feed"],
    buildStaticTasks() {
      return [
        {
          taskKey: "stackoverflow-backup:stackoverflow backup-hot -f json",
          source: "stackoverflow",
          capability: "feed",
          commandName: "backup-hot",
          argv: ["stackoverflow", "backup-hot", "-f", "json"],
          helpArgv: ["stackoverflow", "backup-hot", "--help"],
          breakerKey: "stackoverflow:feed:hot",
          adapterKey: "stackoverflow-backup",
          routeRole: "backup",
          taskFamily: "hot",
        },
      ];
    },
    buildDynamicTasks() {
      return [];
    },
    normalize() {
      return [];
    },
  };

  const registry = createSourceAdapterRegistry(
    [primaryAdapter, backupAdapter],
    [
      {
        source: "stackoverflow",
        capability: "feed",
        taskFamily: "hot",
        primaryAdapterKey: "stackoverflow-primary",
        backupAdapterKeys: ["stackoverflow-backup"],
      },
    ],
  );

  const payloads = await collectLiveSourcePayloads(
    {
      openCliBin: "opencli",
      timeoutMs: 1000,
      sources: ["stackoverflow"],
      adapterRegistry: registry,
    },
    async () => "help",
    async (_bin, argv) => [{ argv: argv.join(" ") }],
  );

  assert.deepEqual(
    payloads.map((payload) => payload.adapterKey),
    ["stackoverflow-primary"],
  );
  assert.deepEqual(
    payloads.map((payload) => payload.commandName),
    ["primary-hot"],
  );
});

test("normalizeCollectedPayloads uses the payload adapter key", () => {
  const primaryAdapter: SourceAdapter = {
    key: "stackoverflow-primary",
    source: "stackoverflow",
    supports: ["feed"],
    buildStaticTasks() {
      return [];
    },
    buildDynamicTasks() {
      return [];
    },
    normalize() {
      return [
        {
          id: "primary",
          source: "stackoverflow",
          sourceItemId: "primary",
          title: "Primary",
          summary: "",
          url: "",
          publishedAt: "2026-04-29T00:00:00.000Z",
          collectedAt: "2026-04-29T00:00:00.000Z",
          timestampOrigin: "collected",
          score: 0,
          answerCount: 0,
          commentCount: 0,
          tags: [],
          contentType: "primary",
          isQuestion: true,
          rawMeta: {},
        },
      ];
    },
  };

  const backupAdapter: SourceAdapter = {
    key: "stackoverflow-backup",
    source: "stackoverflow",
    supports: ["feed"],
    buildStaticTasks() {
      return [];
    },
    buildDynamicTasks() {
      return [];
    },
    normalize() {
      return [
        {
          id: "backup",
          source: "stackoverflow",
          sourceItemId: "backup",
          title: "Backup",
          summary: "",
          url: "",
          publishedAt: "2026-04-29T00:00:00.000Z",
          collectedAt: "2026-04-29T00:00:00.000Z",
          timestampOrigin: "collected",
          score: 0,
          answerCount: 0,
          commentCount: 0,
          tags: [],
          contentType: "backup",
          isQuestion: true,
          rawMeta: {},
        },
      ];
    },
  };

  const registry = createSourceAdapterRegistry(
    [primaryAdapter, backupAdapter],
    [
      {
        source: "stackoverflow",
        capability: "feed",
        primaryAdapterKey: "stackoverflow-primary",
        backupAdapterKeys: ["stackoverflow-backup"],
      },
    ],
  );

  const normalized = normalizeCollectedPayloads(
    [
      {
        source: "stackoverflow",
        capability: "feed",
        taskKey: "stackoverflow-backup:stackoverflow hot -f json",
        breakerKey: "stackoverflow:feed:hot",
        adapterKey: "stackoverflow-backup",
        routeRole: "backup",
        executionDecision: "executed",
        commandName: "hot",
        argv: ["stackoverflow", "hot", "-f", "json"],
        startedAt: "2026-04-29T00:00:00.000Z",
        finishedAt: "2026-04-29T00:00:01.000Z",
        latencyMs: 1000,
        status: "success",
        errorText: null,
        helpOutput: "help",
        payload: [{ title: "sample" }],
      },
    ],
    registry,
  );

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.contentType, "backup");
});
