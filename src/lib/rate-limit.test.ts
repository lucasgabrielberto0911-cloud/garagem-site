import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  checkRateLimit, clearRateLimit, checkDistributedRateLimit,
  checkSellLeadRateLimit, checkWantedLeadRateLimit, checkPhotoJpgRateLimit,
  checkVenderPhotoRateLimit, checkLoginRateLimit,
} from "./rate-limit";
import { prisma } from "./prisma";
import { mockPrismaMethod } from "./test-mock";

function isolate(t: TestContext) {
  for (const [key, value] of Object.entries({
    UPSTASH_REDIS_REST_URL: "https://contador.test",
    UPSTASH_REDIS_REST_TOKEN: "credencial-ficticia",
    DATABASE_URL: "postgresql://local/teste",
    RATE_LIMIT_MEMORY_ONLY: "",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  t.mock.method(console, "warn", () => {});
  t.mock.method(console, "error", () => {});
}

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


test("rotas públicas bloqueiam e alertam quando Upstash e banco falham", async (t) => {
  isolate(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("credencial-ficticia"); });
  mockPrismaMethod(t, prisma, "$executeRaw", async () => { throw new Error("credencial-ficticia"); });
  const alerts: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { alerts.push(args); });
  for (const check of [checkSellLeadRateLimit, checkWantedLeadRateLimit, checkPhotoJpgRateLimit]) {
    assert.deepEqual(await check("cliente"), { ok: false, unavailable: true, retryAfterSec: 30 });
  }
  assert.equal(alerts.length, 3);
  assert.match(JSON.stringify(alerts), /ALERTA/);
  assert.doesNotMatch(JSON.stringify(alerts), /credencial-ficticia|cliente/);
});

test("sem contadores configurados ou em modo memória, público continua bloqueado", async (t) => {
  isolate(t);
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.DATABASE_URL;
  assert.equal((await checkSellLeadRateLimit("sem-banco")).unavailable, true);
  process.env.DATABASE_URL = "postgresql://local/teste";
  process.env.RATE_LIMIT_MEMORY_ONLY = "1";
  mockPrismaMethod(t, prisma, "$executeRaw", async () => { throw new Error("Não deve consultar banco"); });
  assert.equal((await checkWantedLeadRateLimit("memoria")).unavailable, true);
});

test("falha do Upstash usa banco compartilhado antes de bloquear", async (t) => {
  isolate(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("fora"); });
  mockPrismaMethod(t, prisma, "$executeRaw", async () => 0);
  mockPrismaMethod(t, prisma, "$queryRaw", async () => [{ count: 1, expiresAt: new Date(Date.now() + 60_000) }]);
  assert.equal((await checkSellLeadRateLimit("banco")).ok, true);
});

test("Upstash respeita limite e rejeita resposta inválida sem liberar público", async (t) => {
  isolate(t);
  delete process.env.DATABASE_URL;
  for (const count of [1, 6]) {
    t.mock.method(globalThis, "fetch", async () => Response.json([{ result: count }, { result: 0 }]));
    const result = await checkSellLeadRateLimit("redis");
    assert.equal(result.ok, count === 1);
    assert.equal(result.unavailable, undefined);
  }
  for (const data of [[], [{ error: "fora" }, { result: 1 }], [{ result: 0 }, { result: 1 }], [{ result: 1 }, { error: "fora" }]]) {
    t.mock.method(globalThis, "fetch", async () => Response.json(data));
    assert.equal((await checkSellLeadRateLimit("invalido")).unavailable, true);
  }
});

test("login e upload mantêm política anterior de contingência em memória", async (t) => {
  isolate(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("fora"); });
  mockPrismaMethod(t, prisma, "$executeRaw", async () => { throw new Error("fora"); });
  assert.equal((await checkLoginRateLimit("legado-login")).ok, true);
  assert.equal((await checkVenderPhotoRateLimit("legado-upload")).ok, true);
  assert.equal((await checkDistributedRateLimit("publico", { max: 1, windowMs: 60_000, failClosed: true })).ok, false);
});
