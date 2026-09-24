import assert from "node:assert/strict";
import { test } from "node:test";
import { isVehicleCuid } from "./vehicle-slug";
import {
  CATALOG_DEALER_ID,
  META_CSV_COLUMNS,
  buildCatalogCsv,
  catalogFeedImageUrl,
  catalogPixelAutoFields,
  catalogVehicleRow,
  csvEscape,
  formatCatalogPrice,
  includeConsignedInFeed,
  mapCatalogBodyStyle,
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
    { id: "photoaaaaaaaaaaaaaaaaaa", url: "https://cdn.example/a.webp" },
    { id: "photobbbbbbbbbbbbbbbbbb", url: "https://cdn.example/b.jpg" },
  ],
};

test("vehicle_id do feed é o Prisma CUID e a URL leva UTM do catálogo", () => {
  const row = catalogVehicleRow(sample, "https://www.suagaragem.net");
  assert.ok(row);
  assert.equal(row.vehicle_id, VEHICLE_CUID);
  assert.equal(isVehicleCuid(row.vehicle_id), true);
  const url = new URL(row.url);
  assert.match(url.pathname, /estoque\/hyundai-hb20-platinum-2024-cmt0ewzpg0000lc0493fl02h7$/);
  assert.equal(url.searchParams.get("utm_source"), "meta");
  assert.equal(url.searchParams.get("utm_medium"), "dinamico");
  assert.equal(url.searchParams.get("utm_campaign"), "catalogo_veiculos");
  assert.equal(row.price, "82900.00 BRL");
  assert.equal(row.availability, "AVAILABLE");
  assert.equal(row.condition, "EXCELLENT");
  assert.equal(row.state_of_vehicle, "Used");
  assert.equal(row["mileage.unit"], "KM");
  assert.equal(row.transmission, "Automatic");
  assert.equal(row.fuel_type, "FLEX");
  assert.equal(row.body_style, "HATCHBACK");
  assert.equal(row.dealer_id, CATALOG_DEALER_ID);
  assert.equal(row.dealer_name, "Sua Garagem");
  assert.match(row["image[0].url"], /\/api\/catalog-jpg\/.+\/photoaaaaaaaaaaaaaaaaaa$/);
  assert.equal(row["image[1].url"], "https://cdn.example/b.jpg");
  assert.equal(row["image[2].url"], "");
});

test("sem foto o veículo fica de fora do catálogo", () => {
  assert.equal(
    catalogVehicleRow({ ...sample, photos: [] }, "https://www.suagaragem.net"),
    null,
  );
});

test("JPG e PNG públicos seguem direto; WebP passa pela conversão", () => {
  assert.equal(
    catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, {
      id: "p1",
      url: "https://cdn.example/foto.png?width=10",
    }),
    "https://cdn.example/foto.png",
  );
  assert.match(
    catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, {
      id: "p1",
      url: "https://cdn.example/foto.webp",
    }),
    /\/api\/catalog-jpg\//,
  );
});

test("CSV do catálogo de veículos usa as colunas do upload manual", () => {
  assert.equal(csvEscape('Motor 1,0 "turbo"'), `"Motor 1,0 ""turbo"""`);
  assert.equal(formatCatalogPrice(89900), "89900.00 BRL");
  assert.equal(mapCatalogTransmission("CVT"), "Automatic");
  assert.equal(mapCatalogFuel("Diesel"), "DIESEL");
  assert.equal(mapCatalogFuel("Etanol"), "OTHER");

  const csv = buildCatalogCsv([sample], "https://www.suagaragem.net");
  assert.equal(csv.split("\n")[0], META_CSV_COLUMNS.join(","));
  assert.match(csv, /^vehicle_id,title,description,url,make,model,year,/);
  assert.match(csv, new RegExp(VEHICLE_CUID));
  assert.match(csv, /82900\.00 BRL/);
  assert.doesNotMatch(csv, /image_link|in stock/);
});

test("carroceria segue o modelo, não SEDAN para tudo", () => {
  assert.equal(mapCatalogBodyStyle("carro", "HR-V", "EX"), "SUV");
  assert.equal(mapCatalogBodyStyle("carro", "Palio Weekend", "Adventure"), "WAGON");
  assert.equal(mapCatalogBodyStyle("carro", "HB20S", "Comfort"), "SEDAN");
  assert.equal(mapCatalogBodyStyle("carro", "Prisma", "Joy"), "SEDAN");
  assert.equal(mapCatalogBodyStyle("carro", "Saveiro", "Robust"), "PICKUP");
  assert.equal(mapCatalogBodyStyle("moto", "CG 160", "Start"), "OTHER");
  assert.equal(mapCatalogBodyStyle("carro", "Modelo Desconhecido", null), "OTHER");
});

test("HR-V com versão Automático e campo Manual vai Automatic no feed", () => {
  const row = catalogVehicleRow(
    {
      ...sample,
      brand: "Honda",
      model: "HR-V",
      version: "EX 1.8 FLEX ONE Automático",
      transmission: "Manual",
      yearModel: 2018,
    },
    "https://www.suagaragem.net",
  );
  assert.ok(row);
  assert.equal(row.transmission, "Automatic");
  assert.equal(row.body_style, "SUV");
  assert.match(row.title, /Honda HR-V EX 1\.8 Flex ONE 2018/);
});

test("endereço, CEP e coordenadas vêm da cidade do carro", () => {
  const linhares = catalogVehicleRow(
    { ...sample, locationCity: "linhares" },
    "https://www.suagaragem.net",
  );
  assert.ok(linhares);
  assert.equal(linhares.postal_code, "29900-000");
  assert.equal(linhares.latitude, "-19.3911");
  assert.equal(linhares.longitude, "-40.0722");
  assert.match(linhares.address, /"city":"Linhares"/);
  assert.doesNotMatch(linhares.address, /Vitória|Vitoria|Aracruz/);

  const serra = catalogVehicleRow(
    { ...sample, locationCity: "serra" },
    "https://www.suagaragem.net",
  );
  assert.equal(serra?.postal_code, "29160-000");
  assert.equal(serra?.latitude, "-20.1286");
  assert.match(serra?.address ?? "", /"city":"Serra"/);
});

test("consignado entra no feed salvo parâmetro explícito", () => {
  assert.equal(includeConsignedInFeed(null), true);
  assert.equal(includeConsignedInFeed(""), true);
  assert.equal(includeConsignedInFeed("1"), true);
  assert.equal(includeConsignedInFeed("0"), false);
  assert.equal(includeConsignedInFeed("false"), false);
});

test("campos do pixel batem com o mesmo veículo do feed", () => {
  const pixel = catalogPixelAutoFields({
    category: "carro",
    model: "HB20",
    version: "Platinum",
    fuel: "Flex",
    transmission: "Automático",
    color: "Branco",
    locationCity: "linhares",
  });
  assert.equal(pixel.body_style, "hatchback");
  assert.equal(pixel.fuel_type, "flex");
  assert.equal(pixel.transmission, "automatic");
  assert.equal(pixel.state_of_vehicle, "Used");
  assert.equal(pixel.postal_code, "29900-000");
  assert.equal(pixel.exterior_color, "Branco");
});
