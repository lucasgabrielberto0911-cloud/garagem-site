import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { beforeEach, test } from "node:test";
import type { FipeIdentity } from "./fipe-history";

type CacheRow = { key: string; status: number; expiresAt: Date; updatedAt: Date; payload?: unknown };
const cache = new Map<string, CacheRow>();
let budget = 0, enabled = true, monthlyWrites = 0;
const prisma = {
  fipeHistoryCache: {
    findUnique: async ({ where }: { where: { key: string } }) => cache.get(where.key) ?? null,
    upsert: async ({ where, create, update }: { where: { key: string }; create: CacheRow; update: Partial<CacheRow> }) => { const row = cache.has(where.key) ? { ...cache.get(where.key)!, ...update } : create; row.updatedAt = new Date(); cache.set(where.key, row); return row; },
    deleteMany: async ({ where }: { where: { key: string } }) => { cache.delete(where.key); },
  },
  fipeMonthlyPrice: { upsert: async () => { monthlyWrites++; } },
  $queryRaw: async (_sql: unknown, key: string) => { const row = cache.get(key); if (row && row.expiresAt > new Date()) return []; cache.set(key, { key, status: 102, expiresAt: new Date(Date.now() + 10000), updatedAt: new Date() }); return [{ key }]; },
  $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
};
const require = createRequire(import.meta.url), loader = Module as unknown as { _load: (id: string, parent: unknown, main: boolean) => unknown }, original = loader._load;
loader._load = function(id, parent, main) {
  if (id === "@/lib/prisma") return { prisma };
  if (id === "@/lib/admin-login-limit") return { checkSharedLimit: async () => ({ ok: ++budget <= 30, retryAfterSec: 60 }) };
  if (id === "./purchase-flags") return { isFipeHistoryEnabled: () => enabled };
  return original.call(this, id, parent, main);
};
let getHistory: typeof import("./fipe-history-store").getFipeHistory;
let codes: typeof import("./fipe-history-store").findPurchaseFipeCodes;
let match: typeof import("./fipe-history-store").findFipeCandidates;
try { const loaded = require("./fipe-history-store.ts"); getHistory = loaded.getFipeHistory; match = loaded.findFipeCandidates; codes = loaded.findPurchaseFipeCodes; } finally { loader._load = original; }
const identity: FipeIdentity = { code: "014045-7", modelYear: 2018, expectedFuel: "Flex", versionLabel: "Fit EX/S 1.5 Flex/Flexone 16V 5p Aut.", transmission: "CVT", confirmed: true, fuelDecision: "Divergência conferida pelo operador nesta fixture." };
const current = { codigo_fipe: identity.code, value_cents: "7591200", periodo: "2026-11", brand_name: "Honda", model_name: identity.versionLabel, model_year: 2018, fuel_name: "Gasolina" };
beforeEach(() => { cache.clear(); budget = 0; enabled = true; monthlyWrites = 0; });
test("referência diária e ficha usam cache persistente; ano explícito sem placa e sem preencher lacunas", async t => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => { urls.push(String(url)); return Response.json(String(url).endsWith("/referencia") ? { periodo: "2026-11-01T00:00:00.000Z" } : { codigo_fipe: identity.code, atual: current, historico: [current] }); });
  const first = await getHistory(identity), second = await getHistory(identity);
  assert.equal(first.valueCents, 7591200); assert.equal(second.history.length, 1); assert.equal(urls.length, 2); assert.equal(monthlyWrites, 2);
  assert.equal(urls[1], "https://api.tabelafipe.info/api/v1/fipe/014045-7?ano=2018"); assert.equal(budget, 2);
});
test("429 preserva Retry-After e bloqueia outras identidades entre instâncias, sem loop", async t => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return new Response(null, { status: 429, headers: { "Retry-After": "120" } }); });
  await assert.rejects(match("Honda", "Fit EX", 2018), (e: unknown) => (e as { status: number; retryAfter: number }).status === 429 && (e as { retryAfter: number }).retryAfter >= 119);
  await assert.rejects(match("Honda", "Civic", 2020)); assert.equal(requests, 1); assert.ok(cache.get("cooldown")!.expiresAt.getTime() > Date.now() + 118000);
});
test("cache negativo curto e flag desligada não geram novas chamadas", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(null, { status: 404 }); });
  await assert.rejects(match("Honda", "Fit EX", 2018)); await assert.rejects(match("Honda", "Fit EX", 2018)); assert.equal(calls, 1);
  enabled = false; await assert.rejects(match("Honda", "Civic", 2020)); assert.equal(calls, 1);
});
test("budget é compartilhado e lease deduplica a mesma consulta em andamento", async t => {
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; await pending; return Response.json({ candidatos: [] }); });
  const first = match("Honda", "Fit EX", 2018);
  await new Promise(resolve => setTimeout(resolve, 10));
  await assert.rejects(match("Honda", "Fit EX", 2018)); release(); await first; assert.equal(calls, 1);
  cache.clear(); budget = 30; await assert.rejects(match("Honda", "Civic", 2020)); assert.equal(calls, 1);
});

test("códigos vindos da placa preservam todas as versões sem match ou confirmação automática", async t => {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const code = String(url).includes("014045-7") ? "014045-7" : "014046-5";
    return Response.json({ codigo_fipe: code, atual: { ...current, codigo_fipe: code } });
  });
  const result = await codes(["014045-7", "014046-5"], 2018);
  assert.deepEqual(result.candidates.map(c => c.code), ["014045-7", "014046-5"]);
  assert.equal(monthlyWrites, 0);
  await assert.rejects(codes(["inválido"], 2018));
});
test("não oculta versão quando um código da placa falha", async t => {
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => String(url).includes("014045-7") ? Response.json({ codigo_fipe: "014045-7", atual: current }) : new Response(null, { status: 404 }));
  await assert.rejects(codes(["014045-7", "014046-5"], 2018), /versões.*indisponíveis/);
});
