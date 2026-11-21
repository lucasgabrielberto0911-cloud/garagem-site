import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DASHBOARD_ALERTS_VISIBLE,
  buildDashboardAlerts,
  buildVehiclePendingList,
  splitDashboardAlerts,
  summarizeStockCapital,
  type DashboardAlertsInput,
} from "./admin-dashboard";

const empty: DashboardAlertsInput = {
  usingSeedPassword: false,
  withoutPhotos: [],
  noFeatured: false,
  staleVehicles: [],
  staleDays: 45,
  placeholders: [],
  noTestimonials: false,
  noGoogleReviews: false,
};

test("sem pendência, lista vazia", () => {
  assert.deepEqual(buildDashboardAlerts(empty), []);
});

test("senha e anúncio sem foto vêm antes de ajuste de cadastro da loja", () => {
  const alerts = buildDashboardAlerts({
    ...empty,
    noGoogleReviews: true,
    placeholders: ["WhatsApp"],
    staleVehicles: [{ id: "s1", brand: "Fiat", model: "Uno", days: 90 }],
    noFeatured: true,
    withoutPhotos: [{ id: "p1", brand: "VW", model: "Gol" }],
    usingSeedPassword: true,
  });
  assert.deepEqual(
    alerts.map((alert) => alert.key),
    [
      "seed-password",
      "no-photo-p1",
      "no-featured",
      "stale-s1",
      "placeholders",
      "no-google-reviews",
    ],
  );
  assert.equal(alerts[1].href, "/admin/veiculos/p1");
});

test("celular mostra as primeiras pendências e guarda o resto", () => {
  const list = Array.from({ length: 7 }, (_, index) => index);
  const { head, rest } = splitDashboardAlerts(list);
  assert.equal(head.length, DASHBOARD_ALERTS_VISIBLE);
  assert.deepEqual(rest, [4, 5, 6]);
  assert.deepEqual(splitDashboardAlerts([1, 2], 4), { head: [1, 2], rest: [] });
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

test("buildVehiclePendingList identifica pendências dos carros ativos, ignora vendido e limita a 5 linhas", () => {
  const result = buildVehiclePendingList({
    saleGaps: [{ id: "sold-gap", brand: "Ford", model: "Ka" }],
    vehicles: [
      {
        id: "v-ok",
        brand: "Toyota",
        model: "Corolla",
        yearModel: 2022,
        status: "disponivel",
        price: 110000,
        purchasePrice: 92000,
        consigned: false,
        description: "Único dono, revisado.",
        photoCount: 8,
      },
      {
        id: "v-consignado-sem-compra",
        brand: "Jeep",
        model: "Renegade",
        yearModel: 2021,
        status: "disponivel",
        price: 95000,
        purchasePrice: null,
        consigned: true,
        description: "Consignado revisado.",
        photoCount: 7,
      },
      {
        id: "v-sem-foto",
        brand: "VW",
        model: "Gol",
        yearModel: 2020,
        status: "disponivel",
        price: 49000,
        purchasePrice: 41000,
        consigned: false,
        description: "Completo.",
        photoCount: 0,
      },
      {
        id: "v-poucas-fotos",
        brand: "Fiat",
        model: "Pulse",
        yearModel: 2023,
        status: "reservado",
        price: 0,
        purchasePrice: null,
        consigned: false,
        description: "",
        photoCount: 3,
      },
      {
        id: "v-sem-legenda",
        brand: "Hyundai",
        model: "HB20",
        yearModel: 2021,
        status: "disponivel",
        price: 62000,
        purchasePrice: 52000,
        consigned: false,
        description: "   ",
        photoCount: 6,
      },
      {
        id: "v-sem-compra",
        brand: "Chevrolet",
        model: "Onix",
        yearModel: 2022,
        status: "disponivel",
        price: 72000,
        purchasePrice: null,
        consigned: false,
        description: "Bom estado.",
        photoCount: 8,
      },
      {
        id: "v-vendido-ignorado",
        brand: "Honda",
        model: "Fit",
        yearModel: 2019,
        status: "vendido",
        price: 0,
        purchasePrice: null,
        consigned: false,
        description: "",
        photoCount: 0,
      },
    ],
  });

  // v-ok e v-consignado-sem-compra e v-vendido-ignorado não entram
  assert.equal(result.total, 5);
  assert.equal(result.items.length, 5);
  assert.equal(result.items[0].key, "vehicle-v-poucas-fotos");
  assert.equal(result.items[0].href, "/admin/veiculos/v-poucas-fotos?view=fotos");
  assert.equal(result.items[1].key, "sale-gap-sold-gap");
  assert.equal(result.items[1].href, "/admin/vendas/nova?veiculo=sold-gap");
  assert.equal(result.items[2].key, "vehicle-v-sem-foto");
  assert.equal(result.items[2].href, "/admin/veiculos/v-sem-foto?view=fotos");
  assert.equal(
    result.items.find((item) => item.key === "vehicle-v-sem-legenda")?.href,
    "/admin/veiculos/v-sem-legenda#itens",
  );
  assert.equal(
    result.items.find((item) => item.key === "vehicle-v-sem-compra")?.href,
    "/admin/veiculos/v-sem-compra?view=operacao",
  );
});
