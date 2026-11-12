import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { extractPurchaseCosts, parseAiCosts, writePurchaseOpinion } from "./admin-ai/purchase-nvidia";
import { DEFAULT_PURCHASE_POLICY } from "./purchase-policy";
import { quickFixture } from "./purchase-quick-fixture";
import { mapQuickPurchase } from "./purchase-quick";
import { simulatePurchase } from "./purchase-simulator";

const previousAdmin = process.env.ADMIN_AI_NVIDIA_API_KEY, previousFallback = process.env.NVIDIA_API_KEY;
beforeEach(() => { process.env.ADMIN_AI_NVIDIA_API_KEY = "chave-ficticia-de-teste"; delete process.env.NVIDIA_API_KEY; });
afterEach(() => {
  if (previousAdmin === undefined) delete process.env.ADMIN_AI_NVIDIA_API_KEY; else process.env.ADMIN_AI_NVIDIA_API_KEY = previousAdmin;
  if (previousFallback === undefined) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = previousFallback;
});
const completion = (value: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });

test("laudo cautelar não é custo padrão da Garagem", () => {
  assert.equal(DEFAULT_PURCHASE_POLICY.defaultCostItems.some((item) => item.key === "laudo"), false);
  const q = quickFixture(), input = mapQuickPurchase(q, []);
  assert.equal(input.costs.some((item) => item.key === "laudo"), false);
});

test("categoria com acento ou maiúscula e nota vazia não derrubam a estimativa", () => {
  const items = parseAiCosts({ items: [{ key: "Chave Reserva", label: "Chave reserva", minCents: 10000, baseCents: 15000, maxCents: 20000, note: "" }] });
  assert.equal(items[0].key, "chave_reserva");
  assert.match(items[0].note ?? "", /confirmar/i);
});

test("chave recusada (401) informa o motivo e não repete a chamada do parecer", async (t) => {
  t.mock.method(console, "warn", () => {});
  const q = { ...quickFixture(), notes: "Trocar pneus" }, input = mapQuickPurchase(q, []), output = simulatePurchase(input);
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  const extracted = await extractPurchaseCosts(input, q);
  assert.equal(extracted.available, false); assert.equal(extracted.failure, "chave_recusada"); assert.equal(extracted.status, 401);
  const opinion = await writePurchaseOpinion(input, q, output, extracted.available, extracted);
  assert.equal(opinion.available, false); assert.match(opinion.warning, /chave da IA foi recusada/); assert.match(opinion.warning, /HTTP 401/);
  assert.match(opinion.warning, /observações ainda não entraram/);
  assert.equal(fetch.mock.callCount(), 1);
});

test("modelo ausente (404), limite (429) e erro do provedor têm motivos próprios", async (t) => {
  t.mock.method(console, "warn", () => {});
  const q = { ...quickFixture(), notes: "Motivos diferentes" }, input = mapQuickPurchase(q, []);
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  assert.equal((await extractPurchaseCosts(input, q)).failure, "modelo_indisponivel");
  fetch.mock.mockImplementation(async () => new Response(null, { status: 429 }));
  assert.equal((await extractPurchaseCosts(input, { ...q, notes: "Limite" })).failure, "limite");
  fetch.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  assert.equal((await extractPurchaseCosts(input, { ...q, notes: "Instável" })).failure, "provedor");
  fetch.mock.mockImplementation(async () => { throw new DOMException("Prazo", "TimeoutError"); });
  assert.equal((await extractPurchaseCosts(input, { ...q, notes: "Prazo" })).failure, "tempo_esgotado");
  fetch.mock.mockImplementation(async () => { throw new TypeError("fetch failed"); });
  assert.equal((await extractPurchaseCosts(input, { ...q, notes: "Rede" })).failure, "rede");
});

test("sem chave informa o motivo e não faz rede", async (t) => {
  delete process.env.ADMIN_AI_NVIDIA_API_KEY;
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Rede proibida"); });
  const q = quickFixture(), input = mapQuickPurchase(q, []), output = simulatePurchase(input);
  const extracted = await extractPurchaseCosts(input, q);
  assert.equal(extracted.failure, "sem_chave");
  const opinion = await writePurchaseOpinion(input, q, output, false, extracted);
  assert.match(opinion.warning, /não configurada/);
  assert.equal(fetch.mock.callCount(), 0);
});

test("custos fora do formato não impedem o parecer, que avisa das observações", async (t) => {
  t.mock.method(console, "warn", () => {});
  const q = { ...quickFixture(), notes: "Pneus gastos" }, input = mapQuickPurchase(q, []), output = simulatePurchase(input);
  const fetch = t.mock.method(globalThis, "fetch", async () => completion({ items: "lixo" }));
  const extracted = await extractPurchaseCosts(input, q);
  assert.equal(extracted.failure, "resposta_invalida");
  fetch.mock.mockImplementation(async () => completion({ grade: 7, vehicle: "Pneus pedem atenção na vistoria.", deal: "O preço informado deixa margem sob as premissas." }));
  const opinion = await writePurchaseOpinion(input, q, output, extracted.available, extracted);
  assert.equal(opinion.available, true);
  assert.match(opinion.warning, /observações ainda não entraram nos custos/);
});
