import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_SALE_LIST_INCLUDE,
  ADMIN_VEHICLE_LIST_SELECT,
  adminVehiclesSearchWhere,
  mapAdminVehicleStatsRow,
} from "./admin-vehicles";

test("contadores separam consignado e não trazem contadores de pendência", () => {
  const stats = mapAdminVehicleStatsRow({
    available: 10,
    reserved: 2,
    sold: 4,
    featured: 3,
    parked: 3,
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
  assert.equal(stats.parked, 3);
  assert.equal(stats.featured, 3);
  assert.equal("withoutVideo" in stats, false);
  assert.equal("withPending" in stats, false);
  assert.equal("withoutPhotos" in stats, false);
});

test("ADMIN_VEHICLE_LIST_SELECT traz só 1 foto de capa + _count e nunca seleciona placa, chassi ou RENAVAM", () => {
  const keys = Object.keys(ADMIN_VEHICLE_LIST_SELECT);
  for (const forbidden of ["plate", "plateEnd", "chassis", "renavam"]) {
    assert.equal(keys.includes(forbidden), false);
  }
  assert.equal(ADMIN_VEHICLE_LIST_SELECT.photos.take, 1);
  assert.equal(ADMIN_VEHICLE_LIST_SELECT._count.select.photos, true);
});

test("adminVehiclesSearchWhere busca por nome, modelo, ano e placa", () => {
  assert.deepEqual(adminVehiclesSearchWhere("   "), {});

  const byYear = adminVehiclesSearchWhere("2022");
  assert.ok(Array.isArray(byYear.OR));
  assert.ok(
    byYear.OR.some((clause) => "year" in clause && clause.year === 2022),
  );
  assert.ok(
    byYear.OR.some(
      (clause) => "yearModel" in clause && clause.yearModel === 2022,
    ),
  );

  const multi = adminVehiclesSearchWhere("Honda Civic 2021");
  assert.ok(Array.isArray(multi.AND));
  assert.equal(multi.AND.length, 3);
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

test("lista de vendas traz chassi, RENAVAM e RG para o contrato não apagá-los", () => {
  assert.equal(ADMIN_SALE_LIST_INCLUDE.vehicle.select.chassis, true);
  assert.equal(ADMIN_SALE_LIST_INCLUDE.vehicle.select.renavam, true);
  assert.equal(ADMIN_SALE_LIST_INCLUDE.customer.select.rg, true);
});
