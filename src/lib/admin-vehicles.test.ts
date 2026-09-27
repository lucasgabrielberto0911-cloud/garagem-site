import assert from "node:assert/strict";
import { test } from "node:test";
import { mapAdminVehicleStatsRow } from "./admin-vehicles";

test("contadores separam consignado e não trazem vídeo", () => {
  const stats = mapAdminVehicleStatsRow({
    available: 10,
    reserved: 2,
    sold: 4,
    featured: 3,
    stale: 1,
    withoutPhotos: 2,
    stockValue: 1000,
    purchaseSum: 400,
    ownedAvailable: 8,
    withCostBasis: 5,
    extraCosts: 50,
  });

  assert.equal(stats.available, 10);
  assert.equal(stats.estoqueCount, 12);
  assert.equal(stats.vendidosCount, 4);
  assert.equal(stats.consignedAvailable, 2);
  assert.equal(stats.invested, 450);
  assert.equal(stats.stockValue, 1000);
  assert.equal(stats.withoutPhotos, 2);
  assert.equal(stats.stale, 1);
  assert.equal(stats.featured, 3);
  assert.equal("withoutVideo" in stats, false);
});

test("contadores aceitam bigint e string do driver", () => {
  const stats = mapAdminVehicleStatsRow({
    available: 3n,
    reserved: "1",
    sold: 0,
    stockValue: "1500.5",
    purchaseSum: "200",
    extraCosts: "10",
    ownedAvailable: 3n,
  });
  assert.equal(stats.available, 3);
  assert.equal(stats.reserved, 1);
  assert.equal(stats.estoqueCount, 4);
  assert.equal(stats.stockValue, 1500.5);
  assert.equal(stats.invested, 210);
  assert.equal(stats.consignedAvailable, 0);
});

test("linha vazia de contadores zera em vez de NaN", () => {
  const stats = mapAdminVehicleStatsRow(undefined);
  assert.equal(stats.available, 0);
  assert.equal(stats.stockValue, 0);
  assert.equal(stats.invested, 0);
  assert.equal(stats.consignedAvailable, 0);
});
