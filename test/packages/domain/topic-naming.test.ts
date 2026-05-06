import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFallbackTopicNaming,
  buildTaxonomyNodes,
  parseTopicNamingLLMOutput,
  validateTopicNamingCandidate,
} from "@devtrend/domain";
import type { TopicCluster } from "../../../packages/contracts/src/index.js";

function buildCluster(overrides: Partial<TopicCluster> = {}): TopicCluster {
  return {
    topicClusterId: "88888888-8888-5888-8888-888888888888",
    stableKey: "topic-cluster:test",
    clusterVersion: "v1",
    ruleVersion: "topic-cluster-rules-v1",
    status: "active",
    slug: "pgvector-retrieval-stability",
    displayName: "Pgvector Retrieval Stability",
    summary: "pgvector retrieval quality drifts across reruns",
    keywords: ["pgvector", "postgres", "vector-search"],
    anchorCanonicalId: "stackoverflow:1",
    representativeEvidence: [],
    sourceMix: [],
    relatedRepos: ["pgvector/pgvector"],
    relatedEntities: ["pgvector"],
    itemCount: 3,
    clusterConfidence: 0.9,
    metadata: {},
    ...overrides,
  };
}

test("parseTopicNamingLLMOutput accepts JSON string envelopes", () => {
  const parsed = parseTopicNamingLLMOutput(
    `{"label":"Pgvector Stability","summary":"topic summary for pgvector usage","keywords":["pgvector","postgres","rag"],"taxonomy":{"l1":"Data Infrastructure","l2":"Databases","l3":"Vector Search"}}`,
  );
  assert.ok(parsed);
  assert.equal(parsed?.label, "Pgvector Stability");
});

test("validateTopicNamingCandidate accepts high-quality LLM output", () => {
  const cluster = buildCluster();
  const validated = validateTopicNamingCandidate(
    cluster,
    {
      label: "Pgvector Retrieval Stability",
      summary:
        "Cross-source reports on unstable pgvector ranking and mitigation patterns.",
      keywords: ["pgvector", "postgres", "vector-search"],
      taxonomy: {
        l1: "Data Infrastructure",
        l2: "Databases",
        l3: "Vector Search",
      },
    },
    "ollama",
    "qwen3.5:4b",
  );
  assert.ok(validated);
  assert.equal(validated?.status, "llm-generated");
  assert.equal(validated?.taxonomyL1, "Data Infrastructure");
});

test("validateTopicNamingCandidate rejects low-quality output and fallback remains deterministic", () => {
  const cluster = buildCluster();
  const validated = validateTopicNamingCandidate(
    cluster,
    {
      label: "AI",
      summary: "too short",
      keywords: ["random"],
      taxonomy: {
        l1: "",
      },
    },
    "ollama",
    "qwen3.5:4b",
  );
  assert.equal(validated, null);

  const fallback = buildFallbackTopicNaming(cluster, "invalid-response");
  assert.equal(fallback.status, "fallback-generated");
  assert.equal(fallback.fallbackReason, "invalid-response");
  assert.equal(fallback.taxonomyL1.length > 0, true);
});

test("buildTaxonomyNodes creates stable hierarchical slugs", () => {
  const nodes = buildTaxonomyNodes({
    status: "fallback-generated",
    label: "MCP Tool Calling Reliability",
    summary: "topic summary",
    keywords: ["mcp", "tool-calling", "agent"],
    taxonomyL1: "AI Engineering",
    taxonomyL2: "LLM Tooling",
    taxonomyL3: "MCP",
    fallbackReason: "low-quality",
    metadata: {},
  });

  assert.equal(nodes.length, 3);
  assert.equal(nodes[0]?.slug, "ai-engineering");
  assert.equal(nodes[1]?.slug, "ai-engineering--llm-tooling");
  assert.equal(nodes[2]?.slug, "ai-engineering--llm-tooling--mcp");
});
