import assert from "node:assert/strict";
import test from "node:test";
import { requestOllamaEmbedding, requestOllamaTopicNaming } from "@devtrend/ai";

test("requestOllamaEmbedding posts to the Ollama embeddings endpoint", async () => {
  let capturedBody: string | null = null;
  let capturedUrl = "";

  const vector = await requestOllamaEmbedding(
    {
      baseUrl: "http://127.0.0.1:11434/",
      model: "nomic-embed-text-v2-moe",
      dimensions: 3,
      timeoutMs: 1000,
    },
    "pgvector retrieval stability",
    async (input, init) => {
      capturedUrl = String(input);
      capturedBody = typeof init?.body === "string" ? init.body : null;
      return new Response(
        JSON.stringify({
          embedding: [0.1, 0.2, 0.3],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  );

  assert.deepEqual(vector, [0.1, 0.2, 0.3]);
  assert.equal(capturedUrl, "http://127.0.0.1:11434/api/embeddings");
  assert.ok(capturedBody);

  const request = JSON.parse(capturedBody ?? "{}") as {
    model?: string;
    prompt?: string;
  };
  assert.equal(request.model, "nomic-embed-text-v2-moe");
  assert.equal(request.prompt, "pgvector retrieval stability");
});

test("requestOllamaEmbedding rejects mismatched vector dimensions", async () => {
  await assert.rejects(
    requestOllamaEmbedding(
      {
        baseUrl: "http://127.0.0.1:11434",
        model: "nomic-embed-text-v2-moe",
        dimensions: 4,
        timeoutMs: 1000,
      },
      "topic clustering guardrails",
      async () =>
        new Response(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
    ),
    /Embedding vector dimension mismatch/,
  );
});

test("requestOllamaTopicNaming sends a non-thinking JSON chat request", async () => {
  let capturedBody: string | null = null;
  let capturedUrl = "";

  const output = (await requestOllamaTopicNaming(
    {
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3.5:4b",
      timeoutMs: 1000,
    },
    '{"clusterId":"cluster-3"}',
    async (input, init) => {
      capturedUrl = String(input);
      capturedBody = typeof init?.body === "string" ? init.body : null;
      return new Response(
        JSON.stringify({
          model: "qwen3.5:4b",
          created_at: "2026-05-06T00:00:00.000Z",
          message: {
            role: "assistant",
            content:
              '{"label":"Local Model Topics","summary":"Local model naming result for clustered topics.","keywords":["local","model","topics"],"taxonomy":{"l1":"Software Engineering","l2":"Developer Tooling","l3":"Topic Modeling"}}',
          },
          done: true,
          done_reason: "stop",
          total_duration: 1,
          load_duration: 1,
          prompt_eval_count: 1,
          prompt_eval_duration: 1,
          eval_count: 1,
          eval_duration: 1,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  )) as string;

  assert.equal(output.includes("Local Model Topics"), true);
  assert.equal(capturedUrl.endsWith("/api/chat"), true);
  assert.ok(capturedBody);

  const request = JSON.parse(capturedBody ?? "{}") as {
    model?: string;
    think?: boolean;
    stream?: boolean;
    format?: string;
    messages?: { role?: string; content?: string }[];
  };
  assert.equal(request.model, "qwen3.5:4b");
  assert.equal(request.think, false);
  assert.equal(request.stream, false);
  assert.equal(request.format, "json");
  assert.equal(request.messages?.[0]?.role, "system");
  assert.equal(request.messages?.[1]?.role, "user");
});
