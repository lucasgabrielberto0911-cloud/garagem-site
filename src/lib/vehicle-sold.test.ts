import assert from "node:assert/strict";
import test from "node:test";
import {
  getReconciliationAction,
  isSoldStatus,
  resolveSoldAtDate,
  shouldHidePriceForStatus,
} from "./vehicle-sold";

test("getReconciliationAction identifica ações para integridade de soldAt", () => {
  // 1. Veículo VENDIDO sem soldAt precisa ser preenchido
  assert.equal(
    getReconciliationAction({ status: "VENDIDO", soldAt: null }),
    "set",
  );
  assert.equal(
    getReconciliationAction({ status: "VENDIDO", soldAt: undefined }),
    "set",
  );

  // 2. Veículo VENDIDO com soldAt já preenchido não precisa de ação
  assert.equal(
    getReconciliationAction({ status: "VENDIDO", soldAt: new Date() }),
    "none",
  );

  // 3. Veículo disponível ou reservado com soldAt precisa ter o campo limpo
  assert.equal(
    getReconciliationAction({ status: "disponivel", soldAt: new Date() }),
    "clear",
  );
  assert.equal(
    getReconciliationAction({ status: "reservado", soldAt: new Date() }),
    "clear",
  );

  // 4. Veículo disponível sem soldAt já está consistente
  assert.equal(
    getReconciliationAction({ status: "disponivel", soldAt: null }),
    "none",
  );
});

test("resolveSoldAtDate respeita a hierarquia de datas de venda", () => {
  const saleDate = new Date("2026-10-10T10:00:00.000Z");
  const soldAtAlt = new Date("2026-10-11T10:00:00.000Z");
  const createdAtSale = new Date("2026-10-12T10:00:00.000Z");
  const updatedAtVehicle = new Date("2026-10-13T10:00:00.000Z");
  const createdAtVehicle = new Date("2026-10-14T10:00:00.000Z");

  // Prioridade 1: Sale.saleDate
  assert.equal(
    resolveSoldAtDate({
      sale: { saleDate, soldAt: soldAtAlt, createdAt: createdAtSale },
      updatedAt: updatedAtVehicle,
    }).getTime(),
    saleDate.getTime(),
  );

  // Prioridade 2: Sale.soldAt
  assert.equal(
    resolveSoldAtDate({
      sale: { soldAt: soldAtAlt, createdAt: createdAtSale },
      updatedAt: updatedAtVehicle,
    }).getTime(),
    soldAtAlt.getTime(),
  );

  // Prioridade 3: Sale.createdAt
  assert.equal(
    resolveSoldAtDate({
      sale: { createdAt: createdAtSale },
      updatedAt: updatedAtVehicle,
    }).getTime(),
    createdAtSale.getTime(),
  );

  // Fallback 1: Vehicle.updatedAt
  assert.equal(
    resolveSoldAtDate({
      sale: null,
      updatedAt: updatedAtVehicle,
      createdAt: createdAtVehicle,
    }).getTime(),
    updatedAtVehicle.getTime(),
  );

  // Fallback 2: Vehicle.createdAt
  assert.equal(
    resolveSoldAtDate({
      sale: null,
      updatedAt: null,
      createdAt: createdAtVehicle,
    }).getTime(),
    createdAtVehicle.getTime(),
  );

  // Fallback 3: Data atual
  const now = Date.now();
  const resolved = resolveSoldAtDate({
    sale: null,
    updatedAt: null,
    createdAt: null,
  });
  assert.ok(Math.abs(resolved.getTime() - now) < 5000);
});

test("isSoldStatus e shouldHidePriceForStatus respeitam regra de negócio", () => {
  assert.equal(isSoldStatus("VENDIDO"), true);
  assert.equal(isSoldStatus("vendido"), true);
  assert.equal(isSoldStatus("disponivel"), false);
  assert.equal(isSoldStatus("reservado"), false);
  assert.equal(isSoldStatus(null), false);

  // Carro vendido nunca exibe preço
  assert.equal(shouldHidePriceForStatus("VENDIDO"), true);
  assert.equal(shouldHidePriceForStatus("vendido"), true);
  assert.equal(shouldHidePriceForStatus("disponivel"), false);
});
