import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeStockCapital } from "./admin-dashboard";
import { NOTICE_KINDS, parseNoticeKind } from "./admin-notifications";

test("avisos do painel mantêm apenas vendas sem pendências de carros", () => {
  assert.deepEqual(NOTICE_KINDS, [{ value: "vendas", label: "Vendas" }]);
  assert.equal(parseNoticeKind(null), "vendas");
  assert.equal(parseNoticeKind("carros"), "vendas");
  assert.equal(parseNoticeKind("vendas"), "vendas");
});

test("summarizeStockCapital soma disponíveis e reservados com compra, soma custos e exclui consignado e sem compra", () => {
  const summary = summarizeStockCapital([
    {
      price: 80000,
      purchasePrice: 65000,
      costsTotal: 2000,
      consigned: false,
      km: 40000,
      status: "disponivel",
    },
    {
      price: 70000,
      purchasePrice: 55000,
      costsTotal: 3000,
      consigned: false,
      km: 30000,
      status: "reservado",
    },
    {
      price: 50000,
      purchasePrice: null,
      costsTotal: 1000,
      consigned: false,
      km: 60000,
      status: "disponivel",
    },
    {
      price: 90000,
      purchasePrice: 70000,
      costsTotal: 5000,
      consigned: true,
      km: 20000,
      status: "disponivel",
    },
    {
      price: 60000,
      purchasePrice: 40000,
      costsTotal: 1000,
      consigned: false,
      km: 50000,
      status: "vendido",
    },
  ]);

  assert.equal(summary.activeCount, 4);
  assert.equal(summary.ownedCount, 3);
  assert.equal(summary.consignedCount, 1);
  assert.equal(summary.stockValue, 200000);
  assert.equal(summary.investedTotal, 125000);
  assert.equal(summary.potentialProfit, 25000);
  assert.equal(summary.withCostBasisCount, 2);
  assert.equal(summary.missingPurchaseCount, 1);
  assert.equal(summary.averageKm, 37500);
});
