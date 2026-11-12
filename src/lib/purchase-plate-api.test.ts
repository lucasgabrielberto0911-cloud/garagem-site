import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { lookupPurchasePlate, parsePurchasePlateApi } from "./purchase-plate";

const previous = process.env.CONSULTA_PLACA_API_KEY;
beforeEach(() => { process.env.CONSULTA_PLACA_API_KEY = "cdp_live_chave-ficticia"; });
afterEach(() => { if (previous === undefined) delete process.env.CONSULTA_PLACA_API_KEY; else process.env.CONSULTA_PLACA_API_KEY = previous; });

const found = (extra: Record<string, unknown> = {}) => ({
  object: "lookup", id: "lkp_01TESTE000000000000000000", status: "completed", plate: "ABC1D23", result: "found", price: { amount: "0.07", currency: "BRL" }, free: false,
  vehicle: { plate: "ABC1D23", brand: "HONDA", model: "FIT", version: "FIT EX 1.5 16V", manufacture_year: 2017, model_year: 2018, color: "PRATA", fuel: "Flex", type: "Automóvel", city: "VITORIA", state: "ES", theft: false, fipe: { code: "014045-7", amount: "70000.00", versions: [{ code: "014045-7", version: "Fit EX 1.5", amount: "70000.00", fuel: "Flex", score: 0.9 }, { code: "014046-5", version: "Fit EXL 1.5", amount: "72000.00", fuel: "Flex", score: 0.7 }] } },
  created_at: "2026-11-12T12:00:00Z", ...extra,
});

test("API: devolve só identidade e códigos FIPE, sem cidade, UF, cor, roubo nem valores", () => {
  const result = parsePurchasePlateApi(found());
  assert.equal(result.brand, "HONDA"); assert.equal(result.model, "FIT"); assert.equal(result.version, "FIT EX 1.5 16V"); assert.equal(result.modelYear, 2018);
  assert.equal(result.fuel, "Flex"); assert.equal(result.confirmed, false); assert.deepEqual(result.codes, ["014045-7", "014046-5"]);
  const text = JSON.stringify(result);
  for (const secret of ["VITORIA", "ES\"", "PRATA", "theft", "70000", "ABC1D23"]) assert.equal(text.includes(secret), false, secret);
});

test("API: placa não encontrada vira 404 e falha da consulta vira 503; formato estranho é recusado", () => {
  assert.throws(() => parsePurchasePlateApi(found({ result: "not_found", vehicle: null })), { status: 404 });
  assert.throws(() => parsePurchasePlateApi(found({ status: "failed", result: "unavailable", vehicle: null })), { status: 503 });
  assert.throws(() => parsePurchasePlateApi({ data: {} }), { status: 503 });
  assert.throws(() => parsePurchasePlateApi(found({ vehicle: { ...found().vehicle, model_year: 9999 } })), { status: 503 });
  assert.throws(() => parsePurchasePlateApi("texto"), { status: 503 });
  const semFipe = parsePurchasePlateApi(found({ vehicle: { ...found().vehicle, fipe: { code: "lixo", amount: "1.00", versions: [{ code: "x" }] } } }));
  assert.deepEqual(semFipe.codes, []);
});

test("API: chamada segura (POST, chave só no cabeçalho, Idempotency-Key, sem redirect) e cache deduplica", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(url, "https://consultadeplaca.net/api/v1/lookups");
    assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error"); assert.ok(init?.signal);
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer cdp_live_chave-ficticia"); assert.match(headers["Idempotency-Key"], /^[0-9a-f-]{36}$/);
    assert.equal(String(url).includes("cdp_live"), false);
    assert.deepEqual(JSON.parse(String(init?.body)), { plate: "API0001" });
    return Response.json(found(), { status: 201 });
  });
  const values = await Promise.all([lookupPurchasePlate("API0001"), lookupPurchasePlate("api-0001")]);
  assert.equal(calls, 1); assert.deepEqual(values[0], values[1]); assert.equal(values[0].codes.length, 2);
});

test("API: 401/403, 402, 422, 429 e 5xx têm mensagens seguras sem expor a chave", async (t) => {
  t.mock.method(console, "warn", () => {});
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: { code: "invalid_api_key" } }), { status: 401 }));
  const keyless = (error: unknown) => !(error as Error).message.includes("cdp_live");
  await assert.rejects(lookupPurchasePlate("API0002"), (error: unknown) => (error as { status: number }).status === 503 && /não está autorizada/.test((error as Error).message) && keyless(error));
  fetch.mock.mockImplementation(async () => new Response(null, { status: 403 }));
  await assert.rejects(lookupPurchasePlate("API0003"), { status: 503 });
  fetch.mock.mockImplementation(async () => new Response(null, { status: 402 }));
  await assert.rejects(lookupPurchasePlate("API0004"), (error: unknown) => (error as { status: number }).status === 503 && /Saldo/.test((error as Error).message));
  fetch.mock.mockImplementation(async () => new Response(null, { status: 422 }));
  await assert.rejects(lookupPurchasePlate("API0005"), { status: 400 });
  fetch.mock.mockImplementation(async () => new Response(null, { status: 429, headers: { "Retry-After": "90" } }));
  await assert.rejects(lookupPurchasePlate("API0006"), { status: 429, retryAfter: 90 });
  fetch.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  await assert.rejects(lookupPurchasePlate("API0007"), { status: 503 });
  fetch.mock.mockImplementation(async () => { throw new Error("segredo da rede cdp_live"); });
  await assert.rejects(lookupPurchasePlate("API0008"), (error: unknown) => /prazo/.test((error as Error).message) && keyless(error));
  fetch.mock.mockImplementation(async () => new Response("não é json", { status: 201 }));
  await assert.rejects(lookupPurchasePlate("API0009"), { status: 503 });
});

test("sem chave usa a fonte de reserva e explica o bloqueio 403", async (t) => {
  delete process.env.CONSULTA_PLACA_API_KEY;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => { assert.equal(String(url).startsWith("https://placafipe.com/placa/"), true); return new Response(null, { status: 403 }); });
  await assert.rejects(lookupPurchasePlate("API0010"), (error: unknown) => (error as { status: number }).status === 503 && /CONSULTA_PLACA_API_KEY/.test((error as Error).message));
});
