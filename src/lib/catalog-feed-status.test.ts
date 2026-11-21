import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATALOG_IMAGE_SLOTS,
  buildCatalogCsv,
  catalogVehicleRow,
} from "./catalog-feed";
import {
  CATALOG_FEED_PATH,
  catalogFeedUrl,
  catalogStatusFor,
  type CatalogStatusVehicle,
} from "./catalog-feed-status";
import { PHOTO_BLOB_ORIGIN, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";

const ORIGIN = "https://www.suagaragem.net";
const VEHICLE_CUID = "cmt0ewzpg0000lc0493fl02ha";

const baseVehicle: CatalogStatusVehicle = {
  id: VEHICLE_CUID,
  category: "carro",
  brand: "Honda",
  model: "Civic",
  version: "EX 2.0",
  yearModel: 2020,
  km: 52000,
  price: 98900,
  fuel: "Flex",
  transmission: "Automático",
  color: "Prata",
  description: "Revisado e pronto para rodar.",
  engine: "2.0",
  locationCity: "linhares",
  status: "disponivel",
  historical: false,
  consigned: false,
  photos: [
    { id: "photo111111111111111111", url: `${PHOTO_BLOB_ORIGIN}/veiculos/1/capa.webp` },
    { id: "photo222222222222222222", url: `${PHOTO_BLOB_ORIGIN}/veiculos/1/lateral.jpg` },
  ],
};

test("carro próprio disponível com foto válida e preço entra no catálogo com o mesmo resultado do CSV", () => {
  const status = catalogStatusFor(baseVehicle, ORIGIN);
  const row = catalogVehicleRow(baseVehicle, ORIGIN);
  const csv = buildCatalogCsv([baseVehicle], ORIGIN);

  assert.equal(status.inCatalog, true);
  assert.deepEqual(status.reasons, []);
  assert.equal(status.feedImageCount, 2);
  assert.ok(row);
  assert.match(csv, new RegExp(VEHICLE_CUID));
});

test("consignado fica fora do catálogo mesmo com foto válida, preço e status disponível", () => {
  const consigned: CatalogStatusVehicle = { ...baseVehicle, consigned: true };
  const status = catalogStatusFor(consigned, ORIGIN);

  assert.equal(status.inCatalog, false);
  assert.deepEqual(status.reasons, ["Consignado (nunca entra)"]);
  assert.equal(status.feedImageCount, 2);
});

test("sem foto fica fora do catálogo com o mesmo descarte do CSV", () => {
  const noPhoto: CatalogStatusVehicle = { ...baseVehicle, photos: [] };
  const status = catalogStatusFor(noPhoto, ORIGIN);

  assert.equal(status.inCatalog, false);
  assert.deepEqual(status.reasons, ["Sem foto"]);
  assert.equal(status.feedImageCount, 0);
  assert.equal(catalogVehicleRow(noPhoto, ORIGIN), null);
  assert.doesNotMatch(buildCatalogCsv([noPhoto], ORIGIN), new RegExp(VEHICLE_CUID));
});

test("foto apenas no Storage do Supabase (não pública) fica fora do catálogo e do CSV", () => {
  const storageOnly: CatalogStatusVehicle = {
    ...baseVehicle,
    photos: [
      {
        id: "photo333333333333333333",
        url: `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/1/a.webp`,
      },
    ],
  };
  const status = catalogStatusFor(storageOnly, ORIGIN);

  assert.equal(status.inCatalog, false);
  assert.deepEqual(status.reasons, ["Sem foto pública"]);
  assert.equal(status.feedImageCount, 0);
  assert.equal(catalogVehicleRow(storageOnly, ORIGIN), null);
});

test("sem preço fica fora do catálogo", () => {
  for (const price of [0, -100, Number.NaN]) {
    const status = catalogStatusFor({ ...baseVehicle, price }, ORIGIN);
    assert.equal(status.inCatalog, false);
    assert.deepEqual(status.reasons, ["Sem preço"]);
  }
});

test("reservado, vendido e histórico recebem selo curto e ficam fora", () => {
  assert.deepEqual(
    catalogStatusFor({ ...baseVehicle, status: "reservado" }, ORIGIN).reasons,
    ["Reservado"],
  );
  assert.deepEqual(
    catalogStatusFor({ ...baseVehicle, status: "vendido" }, ORIGIN).reasons,
    ["Vendido"],
  );
  assert.deepEqual(
    catalogStatusFor({ ...baseVehicle, historical: true }, ORIGIN).reasons,
    ["Histórico"],
  );
});

test("contagem de fotos do feed respeita o limite CATALOG_IMAGE_SLOTS", () => {
  const manyPhotos = Array.from({ length: CATALOG_IMAGE_SLOTS + 4 }, (_, index) => ({
    id: `photo${String(index).padStart(18, "0")}`,
    url: `${PHOTO_BLOB_ORIGIN}/veiculos/1/f${index}.jpg`,
  }));
  const status = catalogStatusFor({ ...baseVehicle, photos: manyPhotos }, ORIGIN);

  assert.equal(status.inCatalog, true);
  assert.equal(status.feedImageCount, CATALOG_IMAGE_SLOTS);
});

test("combina múltiplos motivos e expõe a URL canônica do feed", () => {
  const status = catalogStatusFor(
    { ...baseVehicle, consigned: true, price: 0, photos: [] },
    ORIGIN,
  );
  assert.equal(status.inCatalog, false);
  assert.deepEqual(status.reasons, [
    "Consignado (nunca entra)",
    "Sem preço",
    "Sem foto",
  ]);
  assert.equal(CATALOG_FEED_PATH, "/api/meta/catalog.csv");
  assert.equal(catalogFeedUrl(ORIGIN), "https://www.suagaragem.net/api/meta/catalog.csv");
});
