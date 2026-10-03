import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expectedMargin,
  extrasTotal,
  hasCostBasis,
  investedTotal,
} from "./vehicle-ops";

const costs = [{ amount: 1500 }, { amount: 500 }];

test("carro próprio: compra + custos entram no investido e na margem", () => {
  assert.equal(investedTotal(40000, costs), 42000);
  assert.equal(hasCostBasis(40000, costs), true);
  assert.equal(expectedMargin(50000, 40000, costs), 8000);
});

test("consignado: compra e custos antigos ficam fora das contas (lucro N/A)", () => {
  const options = { consigned: true };
  assert.equal(investedTotal(40000, costs, options), 0);
  assert.equal(hasCostBasis(40000, costs, options), false);
  assert.equal(expectedMargin(50000, 40000, costs, options), 50000);
  assert.equal(hasCostBasis(40000, 2000, options), false);
});

test("lista do painel manda a soma dos custos em vez das linhas", () => {
  assert.equal(extrasTotal(2000), 2000);
  assert.equal(extrasTotal(Number.NaN), 0);
  assert.equal(investedTotal(40000, 2000), 42000);
  assert.equal(hasCostBasis(null, 2000), false);
  assert.equal(hasCostBasis(null, 0), false);
  assert.equal(expectedMargin(50000, null, 2000, { consigned: false }), 48000);
});

test("centavos somam precisamente; extras não completam aquisição ausente", () => {
  assert.equal(extrasTotal([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);
  assert.equal(investedTotal(100.5, [{ amount: 25.35 }]), 125.85);
  assert.equal(expectedMargin(200.05, 100.5, [{ amount: 25.35 }]), 74.2);
  assert.equal(hasCostBasis(null, [{ amount: 10000 }]), false);
});
