import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { extractPurchaseCosts, writePurchaseOpinion, parseAiCosts, purchaseAiPayload, redactPurchaseText, PURCHASE_AI_MODEL } from "./admin-ai/purchase-nvidia";
import { quickFixture } from "./purchase-quick-fixture";
import { mapQuickPurchase } from "./purchase-quick";
import { simulatePurchase } from "./purchase-simulator";
const previousAdmin = process.env.ADMIN_AI_NVIDIA_API_KEY, previousFallback = process.env.NVIDIA_API_KEY;
beforeEach(() => { process.env.ADMIN_AI_NVIDIA_API_KEY = "chave-ficticia-de-teste"; delete process.env.NVIDIA_API_KEY; });
afterEach(() => { if (previousAdmin === undefined) delete process.env.ADMIN_AI_NVIDIA_API_KEY; else process.env.ADMIN_AI_NVIDIA_API_KEY = previousAdmin; if (previousFallback === undefined) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = previousFallback; });
const item = { key: "pneus", label: "Troca de pneus", minCents: 100000, baseCents: 150000, maxCents: 200000, note: "Estimativa, confirmar medida." };
const completion = (value: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
test("sanitização impede placa, CPF, telefone, chassi e RENAVAM inclusive no texto livre", () => {
  const text = "ABC1D23 ABC-1234 123.456.789-09 (27) 99999-1234 9BWZZZ377VT004251 12345678901";
  const safe = redactPurchaseText(text);
  for (const secret of ["ABC1D23", "ABC-1234", "123.456", "99999-1234", "9BWZZZ", "12345678901"]) assert.ok(!safe.includes(secret), secret);
  const q = { ...quickFixture(), notes: text }, payload = JSON.stringify(purchaseAiPayload(mapQuickPurchase(q, []), q));
  assert.ok(!payload.includes(q.plate)); assert.ok(!payload.includes("source")); assert.ok(!payload.includes("12345678901"));
});
test("parser de custos rejeita centavos fracionários, faixas inválidas, duplicatas e não aceita totais da IA", () => {
  assert.equal(parseAiCosts({ items: [item], total: 1 })[0].baseCents, 150000);
  for (const items of [[{ ...item, baseCents: 1.5 }], [{ ...item, minCents: 999999 }], [item, item], [{ ...item, maxCents: Infinity }]]) assert.throws(() => parseAiCosts({ items }));
});
test("NVIDIA isolada: extração entra no motor, parecer usa números finais e cache deduplica", async t => {
  const q = { ...quickFixture(), notes: "Trocar pneus; placa ABC1D23; CPF 123.456.789-09" }, input = mapQuickPurchase(q, []);
  const payloads: Array<Record<string, unknown>> = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "https://integrate.api.nvidia.com/v1/chat/completions"); assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body)); assert.equal(body.model, PURCHASE_AI_MODEL); assert.equal(JSON.stringify(body).includes(q.plate), false);
    const payload = JSON.parse(body.messages[1].content); payloads.push(payload);
    return completion(payload.engine ? { grade: 8, vehicle: "Avaliar pneus e confirmar medida.", deal: "O preço deixa margem sob as premissas." } : { items: [item] });
  });
  const extracted = await extractPurchaseCosts(input, q); assert.equal(extracted.available, true);
  const mapped = mapQuickPurchase(q, extracted.items), output = simulatePurchase(mapped);
  const opinion = await writePurchaseOpinion(mapped, q, output, true);
  assert.equal(opinion.available, true); assert.equal(opinion.grade, 8);
  const engine = payloads[1].engine as { idealCents: number }; assert.equal(engine.idealCents, output.idealCents);
  await extractPurchaseCosts(input, q); await writePurchaseOpinion(mapped, q, output, true); assert.equal(payloads.length, 2);
  const expensive = { ...q, askedPriceCents: 10_000_000 }, lossInput = mapQuickPurchase(expensive, extracted.items), lossOutput = simulatePurchase(lossInput);
  assert.ok(lossOutput.scenarios[1].calculation!.resultCents < 0);
  assert.ok((await writePurchaseOpinion(lossInput, expensive, lossOutput, true)).grade! <= 4);
});
test("sem chave não faz rede; fallback usa motor e laudo reprovado limita nota", async t => {
  delete process.env.ADMIN_AI_NVIDIA_API_KEY;
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Rede proibida"); });
  const q = { ...quickFixture(), inspection: "reprovado" as const }, input = mapQuickPurchase(q, []), output = simulatePurchase(input);
  assert.equal((await extractPurchaseCosts(input, q)).available, false);
  const opinion = await writePurchaseOpinion(input, q, output, false); assert.equal(opinion.available, false); assert.ok(opinion.grade! <= 3); assert.match(opinion.warning, /indisponível/);
});
test("429, timeout, resposta inválida ou dinheiro inventado degradam para os números do motor", async t => {
  const q = { ...quickFixture(), notes: "Caso de erro único" }, input = mapQuickPurchase(q, []), output = simulatePurchase(input);
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));
  assert.equal((await extractPurchaseCosts(input, q)).available, false);
  fetch.mock.mockImplementation(async () => { throw new DOMException("Prazo", "TimeoutError"); });
  assert.equal((await extractPurchaseCosts(input, q)).available, false);
  fetch.mock.mockImplementation(async () => completion({ grade: 10, vehicle: "Lucro de R$ 999999", deal: "Ofereça R$ 1" }));
  const opinion = await writePurchaseOpinion(input, q, output, true); assert.equal(opinion.available, false); assert.equal(output.idealCents, simulatePurchase(input).idealCents);
  process.env.NVIDIA_API_KEY = "fallback-ficticio"; delete process.env.ADMIN_AI_NVIDIA_API_KEY;
  fetch.mock.mockImplementation(async (_url: string | URL | Request, init?: RequestInit) => { assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer fallback-ficticio"); return completion({ items: [] }); });
  assert.equal((await extractPurchaseCosts(input, { ...q, notes: "Fallback diferente" })).available, true);
});
