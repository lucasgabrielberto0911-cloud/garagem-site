import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_GOOD_PHOTOS } from "./admin-dashboard";
import {
  parseStockPending,
  stockPendingWhere,
  vehiclePendingBadges,
} from "./admin-stock-pending";
import { staleCutoffDate } from "./stock-quality";

test("pendências da lista filtram sem foto, sem preço, antigos, com pendência e parados", () => {
  assert.equal(parseStockPending("sem-fotos"), "sem-fotos");
  assert.equal(parseStockPending("sem-preco"), "sem-preco");
  assert.equal(parseStockPending("antigos"), "antigos");
  assert.equal(parseStockPending("com-pendencia"), "com-pendencia");
  assert.equal(parseStockPending("parados"), "parados");
  assert.equal(parseStockPending("desconhecido"), "");

  assert.deepEqual(stockPendingWhere("sem-fotos"), { photos: { none: {} } });
  assert.deepEqual(stockPendingWhere("sem-preco"), { price: { lte: 0 } });

  const pendenciaAntigos = stockPendingWhere("antigos");
  assert.equal(pendenciaAntigos.status, "disponivel");
  assert.ok(pendenciaAntigos.createdAt);
  assert.ok(
    Math.abs(
      (pendenciaAntigos.createdAt as { lt: Date }).lt.getTime() -
        staleCutoffDate().getTime(),
    ) < 5_000,
  );

  const pendenciaParados = stockPendingWhere("parados");
  assert.equal(pendenciaParados.status, "disponivel");
  assert.ok((pendenciaParados.createdAt as { lte: Date }).lte instanceof Date);

  assert.deepEqual(stockPendingWhere(parseStockPending("todos")), {});
});

test("vehiclePendingBadges reutiliza MIN_GOOD_PHOTOS (< 6), Sem legenda e Sem compra só em veículo próprio", () => {
  assert.equal(MIN_GOOD_PHOTOS, 6);

  // Sem preço + sem foto + sem legenda + sem compra (próprio)
  const allMissing = vehiclePendingBadges({
    status: "disponivel",
    price: 0,
    photoCount: 0,
    hasCover: false,
    hasDescription: false,
    purchasePrice: null,
    consigned: false,
  });
  assert.deepEqual(
    allMissing.map((b) => b.label),
    ["Sem preço", "Sem foto", "Sem legenda", "Sem compra"],
  );

  // Poucas fotos (< 6) + sem capa, compra OK
  const fewWithoutCover = vehiclePendingBadges({
    status: "disponivel",
    price: 78900,
    photoCount: 3,
    hasCover: false,
    hasDescription: true,
    purchasePrice: 65000,
    consigned: false,
  });
  assert.deepEqual(
    fewWithoutCover.map((b) => b.label),
    ["Sem capa", "Poucas fotos"],
  );

  // 5 fotos continua sendo "Poucas fotos" (< 6)
  const fivePhotos = vehiclePendingBadges({
    status: "reservado",
    price: 78900,
    photoCount: 5,
    hasCover: true,
    hasDescription: true,
    purchasePrice: 65000,
    consigned: false,
  });
  assert.deepEqual(
    fivePhotos.map((b) => b.label),
    ["Poucas fotos"],
  );

  // 6+ fotos, capa, preço e compra OK, apenas sem legenda
  const missingDescription = vehiclePendingBadges({
    status: "disponivel",
    price: 78900,
    photoCount: 6,
    hasCover: true,
    hasDescription: false,
    purchasePrice: 65000,
    consigned: false,
  });
  assert.deepEqual(
    missingDescription.map((b) => b.label),
    ["Sem legenda"],
  );

  // Próprio completo exceto compra (null ou 0) -> recebe "Sem compra"
  const missingPurchase = vehiclePendingBadges({
    status: "disponivel",
    price: 92000,
    photoCount: 6,
    hasCover: true,
    hasDescription: true,
    purchasePrice: 0,
    consigned: false,
  });
  assert.deepEqual(
    missingPurchase.map((b) => b.label),
    ["Sem compra"],
  );

  // Consignado sem compra nunca recebe "Sem compra"
  const consignedComplete = vehiclePendingBadges({
    status: "disponivel",
    price: 92000,
    photoCount: 6,
    hasCover: true,
    hasDescription: true,
    purchasePrice: null,
    consigned: true,
  });
  assert.deepEqual(consignedComplete, []);
});

test("vehiclePendingBadges não mostra selo verde/OK em carro completo nem em vendido", () => {
  const complete = vehiclePendingBadges({
    status: "disponivel",
    price: 119900,
    photoCount: 8,
    hasCover: true,
    hasDescription: true,
    purchasePrice: 98000,
    consigned: false,
  });
  assert.deepEqual(complete, []);

  const sold = vehiclePendingBadges({
    status: "vendido",
    price: 0,
    photoCount: 0,
    hasCover: false,
    hasDescription: false,
    purchasePrice: null,
    consigned: false,
  });
  assert.deepEqual(sold, []);
});
