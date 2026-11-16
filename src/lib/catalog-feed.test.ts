import assert from "node:assert/strict";
import { test } from "node:test";
import { isVehicleCuid, vehicleSlug } from "./vehicle-slug";
import { PHOTO_BLOB_ORIGIN, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";
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

test("slug remove repetição de tokens da versão já presentes no modelo", () => {
  assert.equal(
    vehicleSlug({ id: VEHICLE_CUID, brand: "Honda", model: "CG 160 Start", version: "160 Start", yearModel: 2023 }),
    `honda-cg-160-start-2023-${VEHICLE_CUID}`,
  );
});

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
    { id: "photoaaaaaaaaaaaaaaaaaa", url: `${PHOTO_BLOB_ORIGIN}/a.webp` },
    { id: "photobbbbbbbbbbbbbbbbbb", url: `${PHOTO_BLOB_ORIGIN}/b.jpg` },
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
  assert.equal(row.year, String(sample.yearModel));
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
  assert.equal(row.dealer_name, "Garagem");
  assert.match(row["image[0].url"], /\/api\/catalog-jpg\/.+\/photoaaaaaaaaaaaaaaaaaa$/);
  assert.equal(row["image[1].url"], `${PHOTO_BLOB_ORIGIN}/b.jpg`);
  assert.equal(row["image[2].url"], "");
});

test("sem foto o veículo fica de fora do catálogo", () => {
  assert.equal(
    catalogVehicleRow({ ...sample, photos: [] }, "https://www.suagaragem.net"),
    null,
  );
});

test("JPG e PNG do Blob seguem direto; WebP passa pela conversão", () => {
  for (const extension of ["jpg", "jpeg", "png"]) {
    const url = `${PHOTO_BLOB_ORIGIN}/foto.${extension}`;
    assert.equal(catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, { id: "p1", url }), url);
  }
  assert.match(
    catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, {
      id: "p1",
      url: `${PHOTO_BLOB_ORIGIN}/foto.webp`,
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

test("CSV público não expõe cidade interna, CEP nem coordenadas do veículo", () => {
  const baseline = catalogVehicleRow(sample, "https://www.suagaragem.net");
  for (const locationCity of ["linhares", "serra", "vitoria", "aracruz"]) {
    const row = catalogVehicleRow({ ...sample, locationCity }, "https://www.suagaragem.net");
    assert.ok(row);
    assert.deepEqual(row, baseline);
    const csv = buildCatalogCsv([{ ...sample, locationCity }]);
    assert.doesNotMatch(csv, /Serra|Vitória|Aracruz|29160-000|29015-000|29190-022/);
  }
});

test("CSV usa endereço completo da loja com padrões e variáveis de ambiente", (t) => {
  const keys = ["META_DEALER_ADDR1", "META_DEALER_CEP"] as const;
  const previous = keys.map((key) => process.env[key]);
  t.after(() => {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  });

  for (const configured of [undefined, "", "   ", "personalizado"]) {
    if (configured === undefined) {
      keys.forEach((key) => { delete process.env[key]; });
    } else {
      process.env.META_DEALER_ADDR1 = configured === "personalizado" ? ' Rua "Teste", 123 ' : configured;
      process.env.META_DEALER_CEP = configured === "personalizado" ? " 29901-234 " : configured;
    }
    const address = {
      addr1: configured === "personalizado" ? 'Rua "Teste", 123' : "Linhares",
      city: "Linhares",
      region: "ES",
      postal_code: configured === "personalizado" ? "29901-234" : "29900-000",
      country: "BR",
    };
    const row = catalogVehicleRow(sample, "https://www.suagaragem.net");
    assert.ok(row);
    assert.deepEqual(JSON.parse(row.address), address);
    assert.equal(row.postal_code, address.postal_code);
    assert.equal(row.latitude, "-19.3911");
    assert.equal(row.longitude, "-40.0722");
    assert.ok(buildCatalogCsv([sample]).includes(csvEscape(JSON.stringify(address))));
  }
});

test("pixel preserva CEP de Vitória e Aracruz", () => {
  for (const [locationCity, postalCode] of [["vitoria", "29015-000"], ["aracruz", "29190-022"]]) {
    assert.equal(catalogPixelAutoFields({ ...sample, locationCity }).postal_code, postalCode);
  }
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

test("fotos do Storage e de hosts externos não geram URLs no feed real", () => {
  for (const extension of ["jpg", "png", "webp"]) {
    for (const source of [PHOTO_STORAGE_ORIGIN + "/storage/v1/object/public/veiculos", "https://cdn.example"]) {
      assert.equal(catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, {
        id: "photoaaaaaaaaaaaaaaaaaa", url: `${source}/camera.${extension}`,
      }), "");
    }
  }
});

test("fotos recusadas são compactadas e veículo sem foto servível sai do CSV", () => {
  const storage = { id: "storage", url: `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/foto.webp` };
  const row = catalogVehicleRow({ ...sample, photos: [storage, sample.photos[0], storage, sample.photos[1]] }, "https://www.suagaragem.net");
  assert.ok(row);
  assert.match(row["image[0].url"], /\/api\/catalog-jpg\//);
  assert.equal(row["image[1].url"], sample.photos[1].url);
  assert.equal(row["image[2].url"], "");
  const afterLegacy = catalogVehicleRow({ ...sample, photos: [...Array.from({ length: 8 }, () => storage), ...sample.photos] }, "https://www.suagaragem.net");
  assert.equal(afterLegacy?.["image[1].url"], sample.photos[1].url);
  const unavailable = { ...sample, id: "sem-imagem-servivel", photos: [storage] };
  assert.equal(catalogVehicleRow(unavailable, "https://www.suagaragem.net"), null);
  const csv = buildCatalogCsv([unavailable, sample]);
  assert.doesNotMatch(csv, /sem-imagem-servivel|supabase\.co/);
  assert.match(csv, new RegExp(VEHICLE_CUID));
});

test("fixture E2E mantém a conversão do Storage apenas com banco local dedicado", () => {
  const previous = { flag: process.env.E2E_TEST, database: process.env.DATABASE_URL };
  try {
    process.env.E2E_TEST = "1";
    process.env.DATABASE_URL = "postgresql://local:local@127.0.0.1:5432/garagem_e2e";
    const photo = { id: "photoaaaaaaaaaaaaaaaaaa", url: `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/camera.jpg` };
    assert.equal(catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, photo),
      `https://www.suagaragem.net/api/catalog-jpg/${VEHICLE_CUID}/${photo.id}`);
    process.env.DATABASE_URL = "postgresql://invalid:invalid@banco.example/garagem_e2e";
    assert.throws(() => catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, photo), /banco local dedicado/);
  } finally {
    if (previous.flag === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous.flag;
    if (previous.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous.database;
  }
});

test("fotos somente R2 entram no feed: JPG/PNG direto, WebP pela rota de conversão", () => {
  const r2 = "https://pub-revisao.r2.dev";
  assert.equal(catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, { id: "p1", url: `${r2}/foto.jpg` }), `${r2}/foto.jpg`);
  assert.equal(
    catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, { id: "photoaaaaaaaaaaaaaaaaaa", url: `${r2}/foto.webp` }),
    `https://www.suagaragem.net/api/catalog-jpg/${VEHICLE_CUID}/photoaaaaaaaaaaaaaaaaaa`,
  );
  const onlyR2 = {
    ...sample,
    photos: [
      { id: "photoaaaaaaaaaaaaaaaaaa", url: `${r2}/a.webp` },
      { id: "photobbbbbbbbbbbbbbbbbb", url: `${r2}/b-card.webp` },
    ],
  };
  const row = catalogVehicleRow(onlyR2, "https://www.suagaragem.net");
  assert.ok(row);
  assert.match(row["image[0].url"], /\/api\/catalog-jpg\/.+\/photoaaaaaaaaaaaaaaaaaa$/);
  assert.match(buildCatalogCsv([onlyR2]), new RegExp(VEHICLE_CUID));
});

test("R2 só entra no feed com a forma de URL pública esperada", () => {
  for (const url of [
    "https://pub-revisao.r2.dev.attacker.com/foto.jpg",
    "https://pub-revisao.r2.dev/foto.jpg?token=x",
    "http://pub-revisao.r2.dev/foto.jpg",
  ]) {
    assert.equal(catalogFeedImageUrl("https://www.suagaragem.net", VEHICLE_CUID, { id: "photoaaaaaaaaaaaaaaaaaa", url }), "", url);
  }
});
