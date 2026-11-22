import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_LIST_PHOTOS,
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

test("vehiclePendingBadges devolve os selos corretos só quando falta algo", () => {
  assert.equal(MIN_LIST_PHOTOS, 5);

  // Sem preço + sem foto + sem descrição
  const allMissing = vehiclePendingBadges({
    status: "disponivel",
    price: 0,
    photoCount: 0,
    hasCover: false,
    hasDescription: false,
  });
  assert.deepEqual(
    allMissing.map((b) => b.label),
    ["Sem preço", "Sem foto", "Sem descrição"],
  );

  // Poucas fotos (< 5) + sem capa
  const fewWithoutCover = vehiclePendingBadges({
    status: "disponivel",
    price: 78900,
    photoCount: 3,
    hasCover: false,
    hasDescription: true,
  });
  assert.deepEqual(
    fewWithoutCover.map((b) => b.label),
    ["Sem capa", "Poucas fotos"],
  );

  // Poucas fotos (4) com capa e descrição
  const fourPhotos = vehiclePendingBadges({
    status: "reservado",
    price: 78900,
    photoCount: 4,
    hasCover: true,
    hasDescription: true,
  });
  assert.deepEqual(
    fourPhotos.map((b) => b.label),
    ["Poucas fotos"],
  );

  // Apenas sem descrição (5+ fotos, capa e preço OK)
  const missingDescription = vehiclePendingBadges({
    status: "disponivel",
    price: 78900,
    photoCount: 5,
    hasCover: true,
    hasDescription: false,
  });
  assert.deepEqual(
    missingDescription.map((b) => b.label),
    ["Sem descrição"],
  );
});

test("vehiclePendingBadges não mostra selo verde/OK em carro completo nem em vendido", () => {
  const complete = vehiclePendingBadges({
    status: "disponivel",
    price: 119900,
    photoCount: 8,
    hasCover: true,
    hasDescription: true,
  });
  assert.deepEqual(complete, []);

  const sold = vehiclePendingBadges({
    status: "vendido",
    price: 0,
    photoCount: 0,
    hasCover: false,
    hasDescription: false,
  });
  assert.deepEqual(sold, []);
});
