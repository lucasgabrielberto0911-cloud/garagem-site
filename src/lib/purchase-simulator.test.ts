import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePurchaseInput } from "./purchase-input";
import { calculatePurchaseScenario, simulatePurchase } from "./purchase-simulator";
import { scorePurchase } from "./purchase-score";
import { DEFAULT_PURCHASE_POLICY, parsePurchasePolicy } from "./purchase-policy";
import { fictionalPurchase } from "./purchase-test-fixture";

test("fixture do plano: três resultados, tetos e preço ideal exatos", () => {
  const input = parsePurchaseInput(fictionalPurchase()), result = simulatePurchase(input);
  assert.deepEqual(result.scenarios.map(s => s.calculation!.resultCents), [883000, 989000, 458000]);
  assert.deepEqual(result.scenarios.map(s => s.calculation!.ceilingCents), [6280198, 6381372, 5862135]);
  assert.equal(result.ceilingCents, 5862135);
  assert.equal(result.idealCents, 5750000);
  const score = scorePurchase(input, result);
  assert.equal(score.verdict, "nao_atende");
  assert.equal(score.total, 97);
  assert.equal(score.min, score.max);
  assert.match(score.explanation, /contribuição positiva/);
});
test("compra no teto atende à meta após arredondar; um centavo acima não atende", () => {
  for (let n = 0; n < 250; n++) {
    const i = { resaleCents: 7000000 + n * 119, fixedCents: 250000 + n, upfrontCents: 250000, purchaseCents: 6000000, targetCents: 600000, proportionalRate: 0.02731, monthlyCapitalRate: 0.0137, days: 30 + n };
    const r = calculatePurchaseScenario(i);
    assert.ok(calculatePurchaseScenario({ ...i, purchaseCents: r.ceilingCents }).resultCents >= i.targetCents);
    assert.ok(calculatePurchaseScenario({ ...i, purchaseCents: r.ceilingCents + 1 }).resultCents < i.targetCents);
    assert.ok(calculatePurchaseScenario({ ...i, fixedCents: i.fixedCents + 1000 }).ceilingCents <= r.ceilingCents);
    assert.ok(calculatePurchaseScenario({ ...i, days: i.days + 1 }).ceilingCents <= r.ceilingCents);
    assert.ok(calculatePurchaseScenario({ ...i, targetCents: i.targetCents + 1000 }).ceilingCents <= r.ceilingCents);
    const equilibrium = calculatePurchaseScenario({ ...i, resaleCents: r.breakEvenResaleCents });
    assert.ok(equilibrium.resultCents >= 0);
  }
});
test("frações mínimas de custo arredondam para cima sem tolerância de ponto flutuante", () => {
  const result = calculatePurchaseScenario({ resaleCents: 1, fixedCents: 0, upfrontCents: 0, purchaseCents: 1, targetCents: 1, proportionalRate: 0.00000001, monthlyCapitalRate: 0.00000001, days: 1 });
  assert.equal(result.proportionalCents, 1); assert.equal(result.capitalCents, 1);
  assert.throws(() => calculatePurchaseScenario({ resaleCents: 10000, fixedCents: 0, upfrontCents: 0, purchaseCents: 1, targetCents: 1, proportionalRate: 0.0000000001, monthlyCapitalRate: 0, days: 1 }));
});
test("preço fixo e negociável têm o mesmo resultado e nota no mesmo valor", () => {
  const fixed = fictionalPurchase(), flexible = { ...fixed, priceMode: "negociavel" as const };
  assert.deepEqual(simulatePurchase(fixed), simulatePurchase(flexible));
  assert.deepEqual(scorePurchase(fixed, simulatePurchase(fixed)), scorePurchase(flexible, simulatePurchase(flexible)));
  const expensive = { ...fixed, askedPriceCents: fixed.askedPriceCents + 1000000 };
  assert.ok(scorePurchase(expensive, simulatePurchase(expensive)).dimensions[0].min <= scorePurchase(fixed, simulatePurchase(fixed)).dimensions[0].min);
});
test("desconhecido não é zero, nota fica em intervalo e risco grave bloqueia", () => {
  const input = fictionalPurchase();
  input.costs[0].status = "desconhecido";
  input.conditions.mecanica = { state: "desconhecido", note: "" };
  input.manual = "desconhecido";
  const result = simulatePurchase(input), score = scorePurchase(input, result);
  assert.equal(result.scenarios[0].costs![0].valueCents, 30000);
  assert.equal(result.scenarios[2].costs![0].valueCents, 100000);
  assert.equal(score.verdict, "pendente");
  assert.ok(score.min < score.max); assert.equal(score.total, null); assert.ok(score.coverage < 1);
  input.conditions.mecanica.state = "grave";
  assert.ok(scorePurchase(input, simulatePurchase(input)).blockers.some(b => b.includes("Problema relevante")));
});
test("ausência de revenda e identidade produz pendência, não teto fictício", () => {
  const input = fictionalPurchase(); input.resaleCents.demorada = null; input.identity.confirmed = false;
  const result = simulatePurchase(input);
  assert.equal(result.ceilingCents, null); assert.equal(result.idealCents, null); assert.equal(scorePurchase(input, result).verdict, "pendente");
});
test("nenhuma compra positiva quando o teto é negativo; perdas nunca recebem recomendação", () => {
  const input = fictionalPurchase(); input.resaleCents = { rapida: 10000, normal: 10000, demorada: 10000 };
  const r = simulatePurchase(input); assert.ok(r.ceilingCents! < 0); assert.equal(r.idealCents, null); assert.equal(scorePurchase(input, r).verdict, "nao_atende");
});
test("reserva não desembolsada fica fora do denominador; não reaplica desvalorização", () => {
  const input = fictionalPurchase(); input.costs[0].upfront = false;
  const result = simulatePurchase(input);
  assert.equal(result.scenarios[0].calculation!.investedCents, input.askedPriceCents);
  assert.equal(result.scenarios[0].calculation!.resaleCents, input.resaleCents.rapida);
});
test("fronteiras rejeitam percentuais, overflow, custo zero sem motivo e totais manipulados", () => {
  const input = fictionalPurchase();
  for (const value of [-1, NaN, Infinity, 2.5, 2147483648]) assert.throws(() => parsePurchaseInput({ ...input, askedPriceCents: value }));
  assert.throws(() => parsePurchaseInput({ ...input, parameters: { ...input.parameters, proportionalRate: 1 } }));
  input.costs[1].note = ""; assert.throws(() => parsePurchaseInput(input));
  const clean = parsePurchaseInput({ ...fictionalPurchase(), total: 1, score: 100 }); assert.equal("score" in clean, false);
  assert.throws(() => parsePurchaseInput({ ...fictionalPurchase(), costs: [] }));
  assert.ok(parsePurchasePolicy(DEFAULT_PURCHASE_POLICY));
  assert.equal(parsePurchasePolicy({ ...DEFAULT_PURCHASE_POLICY, score: { weights: {} } }), null);
  assert.equal(parsePurchasePolicy({ ...DEFAULT_PURCHASE_POLICY, unknownCostPlaceholder: { baseCents: -1, maxCents: 0 } }), null);
});
test("evidência vencida não sustenta recomendação; ausência de manual pesa só um ponto", () => {
  const input = fictionalPurchase(); input.askedPriceCents = 5500000;
  const full = scorePurchase(input, simulatePurchase(input)); assert.equal(full.verdict, "compensa");
  input.manual = "ausente";
  assert.equal(full.min - scorePurchase(input, simulatePurchase(input)).min, 1);
  input.resaleEvidence.date = "2020-01-01";
  assert.equal(scorePurchase(input, simulatePurchase(input)).verdict, "pendente");
});
