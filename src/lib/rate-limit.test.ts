import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRateLimit, clearRateLimit } from "./rate-limit";

test("limite em memória bloqueia depois do máximo e libera no reset", () => {
  const key = `test-memory-${Date.now()}`;
  try {
    assert.equal(checkRateLimit(key, { windowMs: 60_000, max: 2 }).ok, true);
    assert.equal(checkRateLimit(key, { windowMs: 60_000, max: 2 }).ok, true);
    const blocked = checkRateLimit(key, { windowMs: 60_000, max: 2 });
    assert.equal(blocked.ok, false);
    assert.ok((blocked.retryAfterSec ?? 0) > 0);
  } finally {
    clearRateLimit(key);
  }
});
