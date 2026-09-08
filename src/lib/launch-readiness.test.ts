import assert from "node:assert/strict";
import { test } from "node:test";
import { chatStockAtCap, CHAT_STOCK_TAKE } from "./chat-stock";
import {
  chatRateLimitStatus,
  geminiKeyConfigured,
} from "./launch-readiness";
import { isUpstashConfigured } from "./rate-limit";

test("Upstash ausente vira exceção operacional explícita", () => {
  const empty = {
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
  };
  assert.equal(isUpstashConfigured(empty), false);
  const status = chatRateLimitStatus(empty);
  assert.equal(status.mode, "memory");
  assert.match(status.launchException ?? "", /Upstash/);
});

test("Upstash configurado libera o lançamento do rate limit", () => {
  const ready = {
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "token",
  };
  assert.equal(isUpstashConfigured(ready), true);
  assert.deepEqual(chatRateLimitStatus(ready), { mode: "upstash" });
});

test("gemini configurado não vaza a chave", () => {
  const env = {
    GEMINI_API_KEY: "secret-key",
  };
  assert.equal(geminiKeyConfigured(env), true);
  assert.doesNotMatch(JSON.stringify(geminiKeyConfigured(env)), /secret-key/);
});

test("teto de 80 anúncios é o sinal para consultar pela pergunta", () => {
  assert.equal(chatStockAtCap(79), false);
  assert.equal(chatStockAtCap(80), true);
  assert.equal(CHAT_STOCK_TAKE, 80);
});
