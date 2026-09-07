import assert from "node:assert/strict";
import { test } from "node:test";
import { isVehicleCuid } from "./vehicle-slug";
import {
  buildCatalogCsv,
  catalogVehicleRow,
  csvEscape,
  formatCatalogPrice,
  mapCatalogFuel,
  mapCatalogTransmission,
  type CatalogFeedVehicle,
} from "./catalog-feed";

const VEHICLE_CUID = "cmt0ewzpg0000lc0493fl02h7";

const sample: CatalogFeedVehicle = {
  id: VEHICLE_CUID,
  category: "carro",
  brand: "Hyundai",
  model: "HB20",
  version: "Platinum",
  yearModel: 2024,
  km: 12000,
  price: 82900,
  fuel: "Flex",
  transmission: "Automático",
  color: "Branco",
  description: "HB20 Platinum com procedência.",
  photos: [
    { url: "https://cdn.example/a.webp" },
    { url: "https://cdn.example/b.webp" },
  ],
};

test("vehicle_id do feed é o Prisma CUID, não o slug", () => {
  const row = catalogVehicleRow(sample, "https://www.suagaragem.net");
  assert.ok(row);
  assert.equal(row.vehicle_id, VEHICLE_CUID);
  assert.equal(row.id, VEHICLE_CUID);
  assert.equal(isVehicleCuid(row.vehicle_id), true);
  assert.match(row.link, /estoque\/hyundai-hb20-platinum-2024-cmt0ewzpg0000lc0493fl02h7$/);
  assert.equal(row.price, "82900.00 BRL");
  assert.equal(row.availability, "in stock");
  assert.equal(row.condition, "used");
  assert.equal(row["mileage.unit"], "KM");
  assert.equal(row.additional_image_link, "https://cdn.example/b.webp");
});

test("sem foto o veículo fica de fora do catálogo", () => {
  assert.equal(
    catalogVehicleRow({ ...sample, photos: [] }, "https://www.suagaragem.net"),
    null,
  );
});

test("CSV escapa aspas e vírgulas", () => {
  assert.equal(csvEscape('Motor 1,0 "turbo"'), `"Motor 1,0 ""turbo"""`);
  assert.equal(formatCatalogPrice(89900), "89900.00 BRL");
  assert.equal(mapCatalogTransmission("CVT"), "AUTOMATIC");
  assert.equal(mapCatalogFuel("Diesel"), "DIESEL");

  const csv = buildCatalogCsv([sample], "https://www.suagaragem.net");
  assert.match(csv, /^vehicle_id,id,title,/);
  assert.match(csv, new RegExp(VEHICLE_CUID));
  assert.match(csv, /82900\.00 BRL/);
});
