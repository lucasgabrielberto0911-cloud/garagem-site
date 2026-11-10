import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { after, beforeEach, test } from "node:test";
import { quickFixture } from "./purchase-quick-fixture";
import { mapQuickPurchase } from "./purchase-quick";
import { DEFAULT_PURCHASE_POLICY } from "./purchase-policy";
import { simulatePurchase } from "./purchase-simulator";
import { fictionalPurchase } from "./purchase-test-fixture";
import { financialGrade, purchaseAiPayload } from "./admin-ai/purchase-nvidia";

type Cache = { status: number; payload: unknown; expiresAt: Date };
const rows = new Map<string, Cache>();
let extractions = 0, opinions = 0;
let previousRevision: unknown = null;
const replayTransaction = { purchaseEvaluation: { findFirst: async () => ({ id: "avaliacao-ficticia" }) }, purchaseEvaluationRevision: { findUnique: async () => previousRevision } };
let published: null | { id: string; version: number; body: unknown } = null;
const originalKey = process.env.ADMIN_AI_NVIDIA_API_KEY, originalFallback = process.env.NVIDIA_API_KEY;
const loader = Module as unknown as { _load: (id: string, parent: unknown, main: boolean) => unknown }, original = loader._load;
loader._load = function(id, parent, main) {
  if (id === "@/lib/prisma") return { prisma: {
    $queryRaw: async () => [{ ready: true }],
    $transaction: async (run: (transaction: typeof replayTransaction) => Promise<unknown>) => run(replayTransaction),
    purchaseEvaluation: replayTransaction.purchaseEvaluation,
    purchasePolicyVersion: { findFirst: async () => published },
    fipeHistoryCache: {
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
      upsert: async ({ where, create }: { where: { key: string }; create: Cache }) => rows.set(where.key, create),
    },
  } };
  if (id === "./admin-ai/purchase-nvidia") return {
    PURCHASE_AI_MODEL: "mistralai/mistral-large-4-1t-a52b", purchaseAiPayload,
    extractPurchaseCosts: async () => { extractions++; return { available: Boolean(process.env.ADMIN_AI_NVIDIA_API_KEY), items: [] }; },
    writePurchaseOpinion: async (_input: unknown, q: Parameters<typeof financialGrade>[1], output: Parameters<typeof financialGrade>[0]) => { opinions++; return { available: Boolean(process.env.ADMIN_AI_NVIDIA_API_KEY), grade: financialGrade(output, q), vehicle: "Veículo fictício.", deal: "Parecer fictício.", warning: "Premissas." }; },
  };
  return original.call(this, id, parent, main);
};
let prepare: typeof import("./purchase-store").preparePurchase;
let save: typeof import("./purchase-store").savePurchase;
try { const store = createRequire(import.meta.url)("./purchase-store.ts"); prepare = store.preparePurchase; save = store.savePurchase; } finally { loader._load = original; }
beforeEach(() => { rows.clear(); previousRevision = null; extractions = 0; opinions = 0; published = null; process.env.ADMIN_AI_NVIDIA_API_KEY = "chave-ficticia"; delete process.env.NVIDIA_API_KEY; });
after(() => { if (originalKey === undefined) delete process.env.ADMIN_AI_NVIDIA_API_KEY; else process.env.ADMIN_AI_NVIDIA_API_KEY = originalKey; if (originalFallback === undefined) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = originalFallback; });

test("preparação curta guarda parecer no JSON e cacheia entrada + saída do motor sem placa na chave", async () => {
  const q = quickFixture(), first = await prepare(q), second = await prepare(q);
  assert.equal(first.input.askedPriceCents, q.askedPriceCents); assert.deepEqual(first.output, simulatePurchase(mapQuickPurchase(q, [])));
  assert.deepEqual(first.evidenceSnapshot.quick, q); assert.deepEqual(first.evidenceSnapshot.opinion, first.opinion);
  assert.deepEqual(second.output, first.output); assert.equal(extractions, 1); assert.equal(opinions, 1); assert.equal(rows.size, 2);
  assert.ok([...rows.keys()].every(key => /^compra-ia:[a-f0-9]{64}$/.test(key) && !key.includes(q.plate)));
  assert.notEqual(first.score.verdict, "pendente"); assert.equal(first.score.scoreVersion, "2.0.0-rapido");
  await prepare({ ...q, askedPriceCents: q.askedPriceCents + 1 }); assert.equal(extractions, 2); assert.equal(opinions, 2);
});
test("sem chave ignora parecer cacheado; entrada sem FIPE calcula sem inventar dinheiro", async () => {
  const q = quickFixture(); await prepare(q); delete process.env.ADMIN_AI_NVIDIA_API_KEY;
  assert.equal((await prepare(q)).opinion!.available, false);
  const result = await prepare({ ...q, fipe: null, identity: { ...q.identity, confirmed: false } });
  assert.equal(result.output.idealCents, null); assert.equal(result.opinion!.grade, null); assert.equal(result.score.verdict, "pendente");
});
test("política publicada governa taxas, meta e repasse; navegador não substitui parâmetros", async () => {
  const policy = { ...DEFAULT_PURCHASE_POLICY, targetCents: 700000, holdingDailyCents: 1500 };
  published = { id: "politica-ficticia", version: 2, body: policy };
  const result = await prepare({ ...quickFixture(), dealType: "repasse", parameters: { targetCents: 1 }, output: { idealCents: 1 }, score: 100 });
  assert.equal(result.output.parameters.targetCents, 700000); assert.equal(result.output.parameters.holdingDailyCents, 1500);
  assert.ok(result.output.scenarios.every(s => s.calculation!.days === 30)); assert.equal(result.policySnapshot.publication!.id, published.id);
});
test("entrada completa antiga preserva o motor e a nota anteriores sem chamar IA", async () => {
  const result = await prepare(fictionalPurchase());
  assert.equal(result.output.ceilingCents, 5862135); assert.equal(result.score.total, 97); assert.equal(result.opinion, null);
  assert.equal(extractions, 0); assert.equal(opinions, 0);
});

test("reenvio idempotente normaliza a ordem de chaves do JSONB e rejeita alteração de entrada", async () => {
  const q = quickFixture(), prepared = await prepare(q);
  const reordered: Record<string, unknown> = Object.fromEntries(Object.entries(q).reverse());
  reordered.identity = Object.fromEntries(Object.entries(q.identity).reverse());
  previousRevision = { input: prepared.input, evidenceSnapshot: { quick: reordered }, number: 1, evaluationId: "avaliacao-ficticia" };
  const body = { input: q, requestKey: "idempotencia-ficticia", expectedVersion: 0 };
  assert.deepEqual(await save("admin-ficticio", body, "avaliacao-ficticia"), { id: "avaliacao-ficticia", currentVersion: 1, replayed: true });
  await assert.rejects(save("admin-ficticio", { ...body, input: { ...q, notes: "Entrada alterada" } }, "avaliacao-ficticia"), { status: 409 });
  previousRevision = { input: prepared.input, evidenceSnapshot: {}, number: 1, evaluationId: "avaliacao-ficticia" };
  await assert.rejects(save("admin-ficticio", body, "avaliacao-ficticia"), { status: 409 });
});
