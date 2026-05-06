import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../../../packages/config/src/index.js";

test("loadConfig applies default ollama embedding settings", () => {
  const config = loadConfig({
    DATABASE_URL: "postgres://example",
    REDIS_URL: "redis://example",
    CLOUDFLARE_API_TOKEN: "",
    CLOUDFLARE_MODEL: "",
    CLOUDFLARE_ACCOUNT_ID: "",
  });

  assert.equal(config.OLLAMA_EMBEDDING_BASE_URL, "http://127.0.0.1:11434");
  assert.equal(config.OLLAMA_EMBEDDING_MODEL, "nomic-embed-text-v2-moe");
  assert.equal(config.OLLAMA_EMBEDDING_DIMENSIONS, 768);
  assert.equal(config.OLLAMA_EMBEDDING_TIMEOUT_MS, 30000);
  assert.equal(config.CLOUDFLARE_API_TOKEN, "");
  assert.equal(config.CLOUDFLARE_MODEL, "");
  assert.equal(config.CLOUDFLARE_ACCOUNT_ID, "");
});

test("loadConfig supports overriding ollama embedding settings", () => {
  const config = loadConfig({
    DATABASE_URL: "postgres://example",
    REDIS_URL: "redis://example",
    OLLAMA_EMBEDDING_BASE_URL: "http://127.0.0.1:11435",
    OLLAMA_EMBEDDING_MODEL: "bge-m3",
    OLLAMA_EMBEDDING_DIMENSIONS: "1024",
    OLLAMA_EMBEDDING_TIMEOUT_MS: "45000",
    CLOUDFLARE_API_TOKEN: "cf-token",
    CLOUDFLARE_MODEL: "@cf/meta/llama-3.1-8b-instruct",
    CLOUDFLARE_ACCOUNT_ID: "account-001",
  });

  assert.equal(config.OLLAMA_EMBEDDING_BASE_URL, "http://127.0.0.1:11435");
  assert.equal(config.OLLAMA_EMBEDDING_MODEL, "bge-m3");
  assert.equal(config.OLLAMA_EMBEDDING_DIMENSIONS, 1024);
  assert.equal(config.OLLAMA_EMBEDDING_TIMEOUT_MS, 45000);
  assert.equal(config.CLOUDFLARE_API_TOKEN, "cf-token");
  assert.equal(config.CLOUDFLARE_MODEL, "@cf/meta/llama-3.1-8b-instruct");
  assert.equal(config.CLOUDFLARE_ACCOUNT_ID, "account-001");
});
