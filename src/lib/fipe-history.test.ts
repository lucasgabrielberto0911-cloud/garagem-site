import assert from "node:assert/strict";
import { test } from "node:test";
import { fipeVariation, parseFipeCandidates, parseFipeCents, parseFipeSnapshot, parseReferenceMonth, type FipeIdentity } from "./fipe-history";

const identity: FipeIdentity = { code: "014045-7", modelYear: 2018, expectedFuel: "Flex", versionLabel: "Fit EX/S 1.5 Flex/Flexone 16V 5p Aut.", transmission: "CVT", confirmed: true, fuelDecision: "Operador confirmou flex; provedor usa rótulo Gasolina nesta versão." };
const current = { codigo_fipe: identity.code, value_cents: "7591200", periodo: "2026-11", brand_name: "Honda", model_name: identity.versionLabel, model_year: 2018, fuel_name: "Gasolina" };
const snapshot = (history: unknown[] = [current]) => ({ codigo_fipe: identity.code, atual: current, historico: history });
test("centavos numéricos/string e mês estrito; rejeita coerções perigosas", () => {
  assert.equal(parseFipeCents("7591200"), 7591200); assert.equal(parseFipeCents(7591200), 7591200);
  for (const v of ["1e3", "12.50", "-1", " 123", "", null, true, 1.5, NaN, Infinity, "9007199254740992", 2147483648]) assert.throws(() => parseFipeCents(v));
  assert.equal(parseReferenceMonth("2026-11-01T00:00:00.000Z"), "2026-11");
  for (const v of ["novembro/2026", "2026-13", "2026-2", "2026-02-30T00:00:00.000Z"]) assert.throws(() => parseReferenceMonth(v));
});
test("EX/EXL empatados permanecem sugestões; versão, ano, câmbio e combustível exigem confirmação", () => {
  const candidates = parseFipeCandidates({ candidatos: [{ codigo_fipe: "014056-2", marca: "Honda", modelo: "Fit EXL", ano: 2018, combustivel: "Gasolina", valor_centavos: "8000000", score: 0.7 }, { codigo_fipe: "014045-7", marca: "Honda", modelo: identity.versionLabel, ano: 2018, combustivel: "Gasolina", valor_centavos: "7591200", score: 0.7 }] });
  assert.equal(candidates.length, 2); assert.equal(candidates[0].model, "Fit EXL");
  assert.throws(() => parseFipeSnapshot(snapshot(), { ...identity, confirmed: false }));
  assert.throws(() => parseFipeSnapshot(snapshot(), { ...identity, transmission: "" }));
  assert.throws(() => parseFipeSnapshot(snapshot(), { ...identity, versionLabel: "Fit EXL" }));
  assert.throws(() => parseFipeSnapshot(snapshot(), { ...identity, modelYear: 2019 }));
  assert.throws(() => parseFipeSnapshot(snapshot(), { ...identity, fuelDecision: "" }));
  const result = parseFipeSnapshot(snapshot(), identity);
  assert.equal(result.fuelRaw, "Gasolina"); assert.equal(result.fuelNormalized, "gasolina"); assert.ok(result.warnings.length);
});
test("24 pontos são 23 intervalos; deduplica mês atual e preserva lacunas", () => {
  // Série sintética para testar intervalos; não representa preços históricos reais.
  const history = Array.from({ length: 24 }, (_, index) => ({ ...current, periodo: new Date(Date.UTC(2026, 10 - index, 1)).toISOString().slice(0, 7), value_cents: String(7591200 + index * 100) }));
  const result = parseFipeSnapshot(snapshot(history), identity);
  assert.equal(result.history.length, 24); assert.equal(fipeVariation(result, 24), null); assert.ok(fipeVariation(result, 12));
  const gap = parseFipeSnapshot(snapshot(history.filter(p => p.periodo !== "2025-11")), identity);
  assert.equal(fipeVariation(gap, 12), null); assert.ok(gap.warnings.some(w => w.includes("Lacuna")));
  assert.throws(() => parseFipeSnapshot(snapshot([...history, { ...current, value_cents: "1" }]), identity));
});
