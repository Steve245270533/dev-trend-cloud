import { Ollama } from "ollama";

export interface EmbeddingRequestConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
}

export interface TopicNamingRequestConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export type EmbeddingVectorGenerator = (
  config: EmbeddingRequestConfig,
  input: string,
) => Promise<number[]>;

export type TopicNamingGenerator = (
  config: TopicNamingRequestConfig,
  prompt: string,
) => Promise<unknown>;

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveEmbeddingEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/embeddings`;
}

function parseEmbeddingVector(payload: unknown): number[] {
  if (!isObjectLike(payload) || !Array.isArray(payload.embedding)) {
    throw new Error("Embedding provider response does not include embedding.");
  }

  const vector = payload.embedding
    .map((value) => (typeof value === "number" ? value : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (vector.length === 0) {
    throw new Error("Embedding provider returned an empty vector.");
  }
  return vector;
}

function createTimeoutFetch(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(timeoutMs, 1000),
    );
    const upstreamSignal = init?.signal;
    const abortOnUpstreamSignal = () => controller.abort();

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        upstreamSignal.addEventListener("abort", abortOnUpstreamSignal, {
          once: true,
        });
      }
    }

    try {
      return await fetchImpl(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener("abort", abortOnUpstreamSignal);
    }
  };
}

export function isTopicNamingRequestConfigured(
  config: TopicNamingRequestConfig,
): boolean {
  return config.baseUrl.trim().length > 0 && config.model.trim().length > 0;
}

export async function requestOllamaEmbedding(
  config: EmbeddingRequestConfig,
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(resolveEmbeddingEndpoint(config.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt: input,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Embedding provider HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const vector = parseEmbeddingVector(payload);
    if (config.dimensions > 0 && vector.length !== config.dimensions) {
      throw new Error(
        `Embedding vector dimension mismatch: expected ${config.dimensions}, got ${vector.length}`,
      );
    }
    return vector;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestOllamaTopicNaming(
  config: TopicNamingRequestConfig,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const client = new Ollama({
    host: config.baseUrl,
    fetch: createTimeoutFetch(config.timeoutMs, fetchImpl),
  });

  const response = await client.chat({
    model: config.model,
    think: false,
    stream: false,
    format: "json",
    messages: [
      {
        role: "system",
        content:
          "You are a topic naming assistant. Return only strict JSON with keys: label, summary, keywords, taxonomy{l1,l2,l3}.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.message.content.trim();
  if (content.length === 0) {
    throw new Error("Ollama naming response is empty.");
  }

  return content;
}
