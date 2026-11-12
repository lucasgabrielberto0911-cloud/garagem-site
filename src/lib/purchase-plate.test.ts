import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { lookupPurchasePlate, normalizePurchasePlate, parsePurchasePlate } from "./purchase-plate";
delete process.env.CONSULTA_PLACA_API_KEY; // estes testes cobrem a fonte de reserva, sem chave
const fixture = readFileSync("e2e/fixtures/compra-placa.html", "utf8");
test("parser da placa preserva todas as versões e só devolve identidade permitida", () => {
  const result = parsePurchasePlate(fixture);
  assert.equal(result.brand, "HONDA"); assert.equal(result.modelYear, 2018); assert.equal(result.model, "Fit");
  assert.deepEqual(result.codes, ["014045-7", "014046-5"]); assert.equal(result.confirmed, false);
  assert.equal(JSON.stringify(result).includes("Município"), false);
  assert.throws(() => parsePurchasePlate("<html>Cloudflare</html>")); assert.throws(() => parsePurchasePlate(fixture.replace("2017/2018", "9999")));
  assert.equal(normalizePurchasePlate("abc-1234"), "ABC1234"); assert.throws(() => normalizePurchasePlate("../segredo"));
});
test("cliente de placa usa fonte documentada, timeout e cache curto com deduplicação", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => { calls++; assert.equal(url, "https://placafipe.com/placa/ABC1D23"); assert.ok(init?.signal); assert.equal(init?.redirect, "error"); return new Response(fixture); });
  const values = await Promise.all([lookupPurchasePlate("ABC1D23"), lookupPurchasePlate("ABC-1D23")]); assert.equal(calls, 1); assert.deepEqual(values[0], values[1]);
});
test("404, 429, falha de rede e HTML inválido têm mensagens seguras e cache negativo", async t => {
  let calls = 0;
  const fetch = t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(null, { status: 404 }); });
  await assert.rejects(lookupPurchasePlate("ZZZ0001"), { status: 404 }); await assert.rejects(lookupPurchasePlate("ZZZ0001")); assert.equal(calls, 1);
  fetch.mock.mockImplementation(async () => new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
  await assert.rejects(lookupPurchasePlate("ZZZ0002"), { status: 429, retryAfter: 120 });
  fetch.mock.mockImplementation(async () => { throw new Error("segredo da rede"); });
  await assert.rejects(lookupPurchasePlate("ZZZ0003"), (error: unknown) => (error as Error).message.includes("prazo") && !(error as Error).message.includes("segredo"));
  fetch.mock.mockImplementation(async () => new Response("<html>Desafio de acesso</html>")); await assert.rejects(lookupPurchasePlate("ZZZ0004"), { status: 503 });
});
