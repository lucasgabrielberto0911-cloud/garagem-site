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
  resolveCatalogFuel,
  resolveCatalogTransmission,
  stripCatalogConfirmationNotes,
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
  assert.equal(CATALOG_DEALER_ID, "SUAGARAGEM");
  assert.equal(row.dealer_id, "SUAGARAGEM");
  assert.notEqual(row.dealer_id, "SUAGARAMEM");
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
  assert.equal(mapCatalogTransmission("Automático"), "Automatic");
  assert.equal(mapCatalogFuel("Diesel"), "DIESEL");
  assert.equal(mapCatalogFuel("Etanol"), "OTHER");
  assert.equal(mapCatalogFuel("FlexPower"), "FLEX");
  assert.equal(mapCatalogFuel("TB Flex"), "FLEX");

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

test("dealer_id do feed é SUAGARAGEM", () => {
  assert.equal(CATALOG_DEALER_ID, "SUAGARAGEM");
  const row = catalogVehicleRow(sample, "https://www.suagaragem.net");
  assert.equal(row?.dealer_id, "SUAGARAGEM");
});

test("Corolla Altis com campo Manual e câmbio CVT na descrição vai Automatic", () => {
  const corolla: CatalogFeedVehicle = {
    ...sample,
    brand: "Toyota",
    model: "Corolla ALTIS",
    version: "ALTIS 2.0 VVT FLEX",
    yearModel: 2018,
    transmission: "Manual",
    fuel: "Flex",
    description: [
      "🔥 NOVIDADE NO ESTOQUE DA GARAGEM!",
      "🚗 Toyota Corolla Altis 2.0 — 2018",
      "📊 Quilometragem: 71.000 km",
      "⚙️ Câmbio: CVT (automático) com modo manual sequencial de 7 marchas virtuais",
      "⛽ Combustível: Flex",
      "🛠️ Motor: 2.0 16V Dual VVT-i",
    ].join("\n"),
  };
  assert.equal(resolveCatalogTransmission(corolla), "Automatic");
  const row = catalogVehicleRow(corolla, "https://www.suagaragem.net");
  assert.equal(row?.transmission, "Automatic");
  assert.equal(
    catalogPixelAutoFields(corolla).transmission,
    "automatic",
  );
});

test("campo CVT e versão com CVT continuam Automatic sem depender da descrição", () => {
  assert.equal(
    resolveCatalogTransmission({
      version: "Altis 2.0",
      transmission: "CVT",
    }),
    "Automatic",
  );
  assert.equal(
    resolveCatalogTransmission({
      version: "EXL CVT",
      transmission: "Automático",
    }),
    "Automatic",
  );
  assert.equal(
    resolveCatalogTransmission({
      version: "1.0",
      transmission: "Manual",
      description: "SUV com piloto automático.\n⚙️ Câmbio: Manual (5 marchas)",
    }),
    "Manual",
  );
});

test("HB20S Gasolina com TB Flex / FlexPower na versão sai FLEX", () => {
  const hb20s: CatalogFeedVehicle = {
    ...sample,
    brand: "Hyundai",
    model: "HB20S",
    version: "Comfort Plus 1.0 TB Flex 12V",
    transmission: "Automático",
    fuel: "Gasolina",
    description:
      "🚗 Hyundai HB20S Comfort Plus Automático — 2023/2024\n⚙️ Câmbio: Automático\n⛽ Combustível: Flex\n🛠️ Motor: Flex",
  };
  assert.equal(resolveCatalogFuel(hb20s), "FLEX");
  assert.equal(
    catalogVehicleRow(hb20s, "https://www.suagaragem.net")?.fuel_type,
    "FLEX",
  );
  assert.equal(catalogPixelAutoFields(hb20s).fuel_type, "flex");

  assert.equal(
    resolveCatalogFuel({
      category: "carro",
      fuel: "Gasolina",
      version: "Sed. Joy/LS 1.0 8V FlexPower 4p",
    }),
    "FLEX",
  );
  assert.equal(
    resolveCatalogFuel({
      category: "carro",
      fuel: "Gasolina",
      model: "HB20S",
      version: "Comfort Plus",
      engine: "1.0 TB Flex",
    }),
    "FLEX",
  );
  assert.equal(
    resolveCatalogFuel({
      category: "carro",
      fuel: "Gasolina",
      model: "HB20S",
      version: "Comfort Plus",
      description:
        "⚙️ *Câmbio:* Automático ⛽ *Combustível: Flex 🛠️ *Motor: Flex",
    }),
    "FLEX",
  );
  assert.equal(
    resolveCatalogFuel({
      category: "carro",
      fuel: "Gasolina",
      version: "2.0 16V",
    }),
    "GASOLINE",
  );
  assert.equal(
    resolveCatalogFuel({
      category: "carro",
      fuel: "Diesel",
      version: "1.0 TB Flex",
    }),
    "DIESEL",
  );
});

test("moto CG/Biz a gasolina não sai FLEX; Biz 125 Flex continua FLEX", () => {
  const cg: CatalogFeedVehicle = {
    ...sample,
    category: "moto",
    brand: "Honda",
    model: "CG 160 Start",
    version: "160 Start",
    fuel: "Flex",
    transmission: "Manual",
    description:
      "🏍️ Honda CG 160 Start — 2023/2023\n⚙️ Câmbio: Manual (5 marchas)\n⛽ Combustível: Gasolina\n🛠️ Motor: 160cc",
  };
  assert.equal(resolveCatalogFuel(cg), "GASOLINE");
  assert.equal(
    catalogVehicleRow(cg, "https://www.suagaragem.net")?.fuel_type,
    "GASOLINE",
  );

  const biz110: CatalogFeedVehicle = {
    ...cg,
    model: "BIZ",
    version: "110i EX",
    transmission: "Semi-automático",
    description:
      "🏍️ Honda Biz 110i — 2023/2023\n⚙️ Câmbio: Semiautomático 4 marchas\n⛽ Combustível: Gasolina",
  };
  assert.equal(resolveCatalogFuel(biz110), "GASOLINE");
  assert.equal(resolveCatalogTransmission(biz110), "Automatic");

  const cgStart: CatalogFeedVehicle = {
    ...cg,
    model: "CG Start 160",
    version: "160cc, Start",
    description: "",
  };
  assert.equal(resolveCatalogFuel(cgStart), "GASOLINE");

  const biz125: CatalogFeedVehicle = {
    ...cg,
    model: "BIZ 125",
    version: "EX 125 FLEX",
    description:
      "🏍️ Honda Biz 125 — 2022/2023\n⚙️ Câmbio: Semiautomático (4 marchas)\n⛽ Combustível: Flex\n🛠️ Motor: 125cc",
  };
  assert.equal(resolveCatalogFuel(biz125), "FLEX");
  assert.equal(
    catalogVehicleRow(biz125, "https://www.suagaragem.net")?.fuel_type,
    "FLEX",
  );

  assert.equal(
    resolveCatalogFuel({
      category: "moto",
      model: "Factor 150",
      version: "ED",
      fuel: "Flex",
      description: "⛽ Combustível: Gasolina\n⚙️ Câmbio: Manual",
    }),
    "GASOLINE",
  );
});

test("descrição do catálogo remove nota de confirmar ano", () => {
  assert.equal(
    stripCatalogConfirmationNotes(
      "Pulse 2022/2023 (confirmar ano…)",
    ),
    "Pulse 2022/2023",
  );
  const pulse: CatalogFeedVehicle = {
    ...sample,
    brand: "Fiat",
    model: "Pulse",
    version: "Drive 1.3 Flex",
    transmission: "CVT",
    fuel: "Flex",
    description:
      "🔥 NOVIDADE NO ESTOQUE DA GARAGEM! 🚗 Fiat Pulse Drive 1.3 Flex Automático — 2022/2023 (confirmar se é 2022/2023 ou 2023/2023) 💲 Valor: R$ 89.900 O SUV moderno. ⚙️ Câmbio: Automático CVT (7 marchas) ⛽ Combustível: Flex (Álcool/Gasolina)",
  };
  const row = catalogVehicleRow(pulse, "https://www.suagaragem.net");
  assert.ok(row);
  assert.equal(row.transmission, "Automatic");
  assert.equal(row.fuel_type, "FLEX");
  assert.doesNotMatch(row.description, /confirmar/i);
  assert.match(row.description, /2022\/2023/);
  assert.match(row.description, /R\$ 89\.900/);
  assert.match(row.description, /Flex \(Álcool\/Gasolina\)/);
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
