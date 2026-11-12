import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { extractPurchaseCosts, parseAiCosts } from "./admin-ai/purchase-nvidia";
import { DEFAULT_PURCHASE_POLICY } from "./purchase-policy";
import { MIN_AI_COST_ITEMS, mapQuickPurchase } from "./purchase-quick";
import { quickFixture } from "./purchase-quick-fixture";
import { simulatePurchase } from "./purchase-simulator";

const previousAdmin = process.env.ADMIN_AI_NVIDIA_API_KEY;
beforeEach(() => { process.env.ADMIN_AI_NVIDIA_API_KEY = "chave-ficticia-de-teste"; });
afterEach(() => { if (previousAdmin === undefined) delete process.env.ADMIN_AI_NVIDIA_API_KEY; else process.env.ADMIN_AI_NVIDIA_API_KEY = previousAdmin; });

const row = (key: string, base: number, note = "Estimativa para este carro.") => ({ key, label: key, minCents: Math.floor(base / 2), baseCents: base, maxCents: base * 2, note });
const aiList = () => parseAiCosts({ items: [row("limpeza", 20000), row("revisao", 90000, "Revisão de um carro com 120 mil km."), row("pneus", 180000, "Quatro pneus carecas citados no texto."), row("documentacao", 55000), row("contingencia", 40000), row("garantia", 50000)] });

test("lista completa da IA substitui a média padrão da política", () => {
  const items = aiList(), q = quickFixture(), input = mapQuickPurchase(q, items);
  assert.ok(items.length >= MIN_AI_COST_ITEMS);
  assert.deepEqual(input.costs.map((c) => c.key), items.map((c) => c.key));
  assert.equal(input.costs.some((c) => ["estetica", "ajustes", "transporte", "chave", "fixas"].includes(c.key)), false);
  assert.equal(input.costs.find((c) => c.key === "garantia")?.upfront, false);
});

test("lista curta ou vazia da IA mantém as reservas da política como piso", () => {
  const q = quickFixture();
  assert.equal(mapQuickPurchase(q, []).costs.length, DEFAULT_PURCHASE_POLICY.defaultCostItems.length);
  const few = mapQuickPurchase(q, aiList().filter((c) => ["pneus", "revisao"].includes(c.key)));
  assert.equal(few.costs.length >= DEFAULT_PURCHASE_POLICY.defaultCostItems.length, true);
  assert.equal(few.costs.find((c) => c.key === "pneus")?.baseCents, 180000);
});

test("a explicação da IA chega até o resultado e os custos entram no motor", () => {
  const q = quickFixture(), output = simulatePurchase(mapQuickPurchase(q, aiList()));
  const costs = output.scenarios[1].costs!;
  const pneus = costs.find((c) => c.key === "pneus") as { note?: string; valueCents: number };
  assert.match(pneus.note ?? "", /pneus carecas/);
  assert.equal(costs.length, 6);
});

test("pedido à IA: estimar todos os custos do carro pelo texto, sem média fixa e sem laudo", async (t) => {
  let system = "", payload: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    system = body.messages[0].content; payload = JSON.parse(body.messages[1].content);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ items: aiList().map(({ key, label, minCents, baseCents, maxCents, note }) => ({ key, label, minCents, baseCents, maxCents, note })) }) } }] });
  });
  const q = { ...quickFixture(), notes: "Pneus carecas, barulho na suspensão dianteira e pintura do para-choque." }, input = mapQuickPurchase(q, []);
  const extracted = await extractPurchaseCosts(input, q);
  assert.equal(extracted.available, true); assert.equal(extracted.items.length, 6);
  assert.match(system, /TODOS os custos prováveis/); assert.match(system, /Não use média fixa da loja/); assert.match(system, /Nunca crie custo de laudo/);
  assert.match(system, /DETRAN-ES/); assert.match(system, /note com até 200 caracteres explicando/);
  assert.match(String(payload.notes), /barulho na suspensão/);
  assert.ok(payload.km !== undefined && payload.identity && payload.purchaseCents);
});
