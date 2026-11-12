import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuickPurchase, mapQuickPurchase, quickPolicy } from "./purchase-quick";
import { DEFAULT_PURCHASE_POLICY } from "./purchase-policy";
import { quickFixture } from "./purchase-quick-fixture";
import { simulatePurchase } from "./purchase-simulator";


test("entrada curta: valida fronteiras, descarta totais e dispensa papelada", () => {
  const q = parseQuickPurchase({ ...quickFixture(), costs: [], score: 10, parameters: {} });
  const input = mapQuickPurchase(q, []), output = simulatePurchase(input);
  assert.equal(input.costs.length, 11); assert.equal(input.resaleEvidence.verified, false);
  assert.equal(input.liquidity.verified, false); assert.ok(output.idealCents); assert.ok(output.scenarios.every(s => s.calculation));
  assert.equal(input.resaleCents.rapida, 6_790_000); assert.equal(input.resaleCents.normal, 7_000_001); assert.equal(input.resaleCents.demorada, 6_580_000);
  assert.equal("score" in q, false);
  for (const bad of [{ notes: "x".repeat(4001) }, { askedPriceCents: 0 }, { askedPriceCents: 1.5 }, { dealType: "qualquer" }, { identity: { brand: 4 } }, { plate: "inválida" }, { identity: { ...q.identity, modelYear: 9999 } }]) assert.throws(() => parseQuickPurchase({ ...q, ...bad }));
});
test("escolher versão é a única confirmação; FIPE consultada exige versão selecionada", () => {
  const q = quickFixture();
  assert.throws(() => parseQuickPurchase({ ...q, identity: { ...q.identity, confirmed: false }, fipe: { ...q.fipe, provider: "tabelafipe.info" } }));
  assert.equal(parseQuickPurchase({ ...q, fipe: { ...q.fipe, provider: "tabelafipe.info" } }).identity.confirmed, true);
});
test("repasse aplica cenário rápido a todas as hipóteses e preserva matemática; sem oferta mantém valor", () => {
  const q = { ...quickFixture(), dealType: "repasse" as const }, policy = quickPolicy(q, DEFAULT_PURCHASE_POLICY);
  const output = simulatePurchase(mapQuickPurchase(q, []), policy);
  assert.deepEqual(output.scenarios.map(s => s.calculation!.days), [30, 30, 30]);
  assert.ok(output.scenarios.every(s => s.calculation!.resaleCents === 6_790_000));
  const normal = mapQuickPurchase(quickFixture(), []), fixed = mapQuickPurchase({ ...quickFixture(), dealType: "sem_oferta" }, []);
  assert.deepEqual(simulatePurchase(normal), simulatePurchase(fixed)); assert.equal(fixed.priceMode, "fixo");
});
test("extração substitui categoria uma vez e mantém reservas; FIPE ausente não inventa revenda", () => {
  const input = mapQuickPurchase(quickFixture(), [{ key: "pneus", label: "Troca de pneus", status: "estimado", baseCents: 200000, minCents: 150000, maxCents: 250000 }]);
  assert.equal(input.costs.filter(c => c.key === "pneus").length, 1);
  assert.equal(simulatePurchase(input).scenarios[1].costs!.find(c => c.key === "pneus")!.valueCents, 200000);
  const missing = simulatePurchase(mapQuickPurchase({ ...quickFixture(), fipe: null }, [])); assert.equal(missing.idealCents, null); assert.equal(missing.ceilingCents, null);
});
