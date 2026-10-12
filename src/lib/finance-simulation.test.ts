import assert from "node:assert/strict";
import test from "node:test";
import { financeWhatsAppMessage, simulateFinance } from "./finance-simulation";

test("parcela pela tabela Price", () => {
  const s = simulateFinance({ price: 60000, down: 20000, months: 48, rateMonthly: 0.02 })!;
  assert.equal(s.financed, 40000);
  assert.ok(Math.abs(s.installment - 1304.1) < 0.5);
});

test("entrada limitada ao preço e sem taxa divide igual", () => {
  assert.equal(simulateFinance({ price: 1000, down: 5000, months: 12 })!.installment, 0);
  assert.equal(simulateFinance({ price: 1200, down: 0, months: 12, rateMonthly: 0 })!.installment, 100);
  assert.equal(simulateFinance({ price: 0, down: 0, months: 12 }), null);
});

test("mensagem traz valores, estimativa e não cita local", () => {
  const simulation = simulateFinance({ price: 60000, down: 20000, months: 36 })!;
  const msg = financeWhatsAppMessage({ label: "Onix 2020", price: 60000, simulation });
  assert.match(msg, /36x/);
  assert.match(msg, /estimativa/);
  assert.match(msg, /aprovação de crédito/);
  assert.doesNotMatch(msg, /Linhares/);
});
