import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCustomerVehicleWhatsAppText } from "./site";
import {
  parseSoldVehicleSlug,
  selectSimilarVehiclesForSoldSlug,
  soldOldLinkMetadata,
  type SoldFallbackCandidate,
} from "./sold-slug-fallback";

const SAMPLE_CUID = "cmshv22g9000fl204fk6qz9l2";

test("extrai marca, modelo e ano de slugs reais de carros com e sem CUID", () => {
  const cases: Array<[string, { label: string; brand: string; model: string; year: number | null; isMoto: boolean }]> = [
    [
      `toyota-yaris-xl-plus-connect-1-5-flex-automatico-2022-${SAMPLE_CUID}`,
      { label: "Toyota Yaris 2022", brand: "Toyota", model: "Yaris", year: 2022, isMoto: false },
    ],
    [
      `volkswagen-golf-highline-1-4-tsi-2014-${SAMPLE_CUID}`,
      { label: "Volkswagen Golf 2014", brand: "Volkswagen", model: "Golf", year: 2014, isMoto: false },
    ],
    [
      `honda-civic-lxr-2-0-flexone-2014-${SAMPLE_CUID}`,
      { label: "Honda Civic 2014", brand: "Honda", model: "Civic", year: 2014, isMoto: false },
    ],
    [
      `honda-hr-v-ex-1-8-flex-one-automatico-2018-${SAMPLE_CUID}`,
      { label: "Honda HR-V 2018", brand: "Honda", model: "HR-V", year: 2018, isMoto: false },
    ],
    [
      `/estoque/chevrolet-onix-plus-ltz-1-0-turbo-2023-${SAMPLE_CUID}`,
      { label: "Chevrolet Onix Plus 2023", brand: "Chevrolet", model: "Onix Plus", year: 2023, isMoto: false },
    ],
    [
      `hyundai-hb20-comfort-1-0-2020-${SAMPLE_CUID}`,
      { label: "Hyundai HB20 2020", brand: "Hyundai", model: "HB20", year: 2020, isMoto: false },
    ],
    [
      `volkswagen-t-cross-comfortline-200-tsi-2022-${SAMPLE_CUID}`,
      { label: "Volkswagen T-Cross 2022", brand: "Volkswagen", model: "T-Cross", year: 2022, isMoto: false },
    ],
    [
      `mercedes-benz-c-180-avantgarde-2019-${SAMPLE_CUID}`,
      { label: "Mercedes-Benz C 180 2019", brand: "Mercedes-Benz", model: "C 180", year: 2019, isMoto: false },
    ],
    [
      `caoa-chery-tiggo-5x-txs-2021-${SAMPLE_CUID}`,
      { label: "Caoa Chery Tiggo 5x 2021", brand: "Caoa Chery", model: "Tiggo 5x", year: 2021, isMoto: false },
    ],
    [
      `toyota-corolla-cross-xre-2-0-2023-${SAMPLE_CUID}`,
      { label: "Toyota Corolla Cross 2023", brand: "Toyota", model: "Corolla Cross", year: 2023, isMoto: false },
    ],
    [
      "toyota-yaris-2022",
      { label: "Toyota Yaris 2022", brand: "Toyota", model: "Yaris", year: 2022, isMoto: false },
    ],
    [
      `peugeot-208-griffe-1-6-2021-${SAMPLE_CUID}`,
      { label: "Peugeot 208 2021", brand: "Peugeot", model: "208", year: 2021, isMoto: false },
    ],
    [
      `honda-civic-lxr-${SAMPLE_CUID}`,
      { label: "Honda Civic", brand: "Honda", model: "Civic", year: null, isMoto: false },
    ],
  ];

  for (const [input, expected] of cases) {
    const parsed = parseSoldVehicleSlug(input);
    assert.equal(parsed.isVehicleLike, true, `esperado veículo para ${input}`);
    assert.equal(parsed.label, expected.label, `label de ${input}`);
    assert.equal(parsed.brand, expected.brand, `brand de ${input}`);
    assert.equal(parsed.model, expected.model, `model de ${input}`);
    assert.equal(parsed.year, expected.year, `year de ${input}`);
    assert.equal(parsed.isMoto, expected.isMoto, `isMoto de ${input}`);
  }
});

test("identifica slugs de motos com cilindrada", () => {
  const cg = parseSoldVehicleSlug(`honda-cg-160-start-2023-${SAMPLE_CUID}`);
  assert.equal(cg.isVehicleLike, true);
  assert.equal(cg.isMoto, true);
  assert.equal(cg.label, "Honda CG 160 2023");

  const fazer = parseSoldVehicleSlug(`yamaha-fazer-250-abs-2022-${SAMPLE_CUID}`);
  assert.equal(fazer.isVehicleLike, true);
  assert.equal(fazer.isMoto, true);
  assert.equal(fazer.label, "Yamaha Fazer 250 2022");
});

test("slugs de lixo, palavras arbitrárias ou placas após marca válida devolvem label null", () => {
  const garbageSlugs = [
    "",
    "   ",
    "asdfgh-lixo-123",
    "ce2emissing000000000000001",
    `veiculo-${SAMPLE_CUID}`,
    "pagina-qualquer-2022",
    "12345",
    "toyota",
    "toyota-12345",
    "toyota-flex-2020",
    "toyota-lixo-2022",
    "honda-ofensa-2023",
    "volkswagen-abc1d23-2021",
    "mercedes-benz-c-lixo-2019",
    "yamaha-motocicleta-2022",
    "foo-bar-baz-9999",
  ];

  for (const input of garbageSlugs) {
    const parsed = parseSoldVehicleSlug(input);
    assert.equal(parsed.isVehicleLike, false, `não deve inventar carro para "${input}"`);
    assert.equal(parsed.label, null, `label deve ser null para "${input}"`);
    assert.equal(parsed.brand, null, `brand deve ser null para "${input}"`);
  }
});

test("gera mensagem pré-preenchida via site.ts para carro, moto e genérico", () => {
  const carParsed = parseSoldVehicleSlug(`toyota-yaris-xl-plus-2022-${SAMPLE_CUID}`);
  assert.equal(
    formatCustomerVehicleWhatsAppText({
      label: carParsed.label,
      isMoto: carParsed.isMoto,
      sold: true,
    }),
    "Oi! Vi que o Toyota Yaris 2022 já foi vendido no site da Garagem e quero ver opções parecidas no estoque.",
  );

  const motoParsed = parseSoldVehicleSlug(`honda-cg-160-start-2023-${SAMPLE_CUID}`);
  assert.equal(
    formatCustomerVehicleWhatsAppText({
      label: motoParsed.label,
      isMoto: motoParsed.isMoto,
      sold: true,
    }),
    "Oi! Vi que a Honda CG 160 2023 já foi vendida no site da Garagem e quero ver opções parecidas no estoque.",
  );

  const genericParsed = parseSoldVehicleSlug("toyota-lixo-2022");
  const genericMsg = formatCustomerVehicleWhatsAppText({
    label: genericParsed.label,
    isMoto: genericParsed.isMoto,
    sold: true,
  });
  assert.match(genericMsg, /anúncio já vendido/);
  assert.doesNotMatch(genericMsg, /toyota|lixo/i);
});

test("metadados de link antigo sempre usam noindex, follow e não emitem canonical", () => {
  const carMeta = soldOldLinkMetadata(`toyota-yaris-2022-${SAMPLE_CUID}`);
  assert.equal(carMeta.title, "Toyota Yaris 2022 já foi vendido | Garagem");
  assert.deepEqual(carMeta.robots, {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  });
  assert.equal(carMeta.alternates, undefined);

  const garbageMeta = soldOldLinkMetadata("toyota-lixo-2022");
  assert.equal(garbageMeta.title, "Anúncio indisponível | Garagem");
  assert.deepEqual(garbageMeta.robots, {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  });
  assert.equal(garbageMeta.alternates, undefined);
});

function makeCandidate(overrides: Partial<SoldFallbackCandidate> & { id: string }): SoldFallbackCandidate {
  return {
    category: "carro",
    brand: "Renault",
    model: "Duster",
    yearModel: 2018,
    price: 65000,
    status: "disponivel",
    featured: false,
    createdAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

test("seleciona até 4 disponíveis priorizando mesma marca, modelo e proximidade de ano/preço", () => {
  const stock: SoldFallbackCandidate[] = [
    makeCandidate({ id: "vendido-honda", brand: "Honda", model: "Civic", yearModel: 2014, price: 70000, status: "vendido" }),
    makeCandidate({ id: "reservado-honda", brand: "Honda", model: "Civic", yearModel: 2014, price: 72000, status: "reservado" }),
    makeCandidate({ id: "moto-honda", category: "moto", brand: "Honda", model: "CG 160", yearModel: 2023, price: 16000 }),
    makeCandidate({ id: "corolla-2023", brand: "Toyota", model: "Corolla", yearModel: 2023, price: 135000, createdAt: "2026-10-10T12:00:00.000Z" }),
    makeCandidate({ id: "duster-2014", brand: "Renault", model: "Duster", yearModel: 2014, price: 54900, createdAt: "2026-09-01T12:00:00.000Z" }),
    makeCandidate({ id: "hrv-2016", brand: "Honda", model: "HR-V", yearModel: 2016, price: 84900, createdAt: "2026-09-02T12:00:00.000Z" }),
    makeCandidate({ id: "civic-2015", brand: "Honda", model: "Civic", yearModel: 2015, price: 74900, createdAt: "2026-09-03T12:00:00.000Z" }),
    makeCandidate({ id: "onix-2016", brand: "Chevrolet", model: "Onix", yearModel: 2016, price: 52000, createdAt: "2026-09-05T12:00:00.000Z" }),
  ];

  const parsed = parseSoldVehicleSlug(`honda-civic-lxr-2-0-2014-${SAMPLE_CUID}`);
  const picked = selectSimilarVehiclesForSoldSlug(stock, parsed, 4);

  assert.equal(picked.length, 4);
  assert.deepEqual(
    picked.map((v) => v.id),
    ["civic-2015", "hrv-2016", "duster-2014", "onix-2016"],
  );
  assert.ok(picked.every((v) => v.status === "disponivel"));
});

test("regra de paridade no celular: estoque com 3 disponíveis retorna 2; com 1 retorna 1", () => {
  const three: SoldFallbackCandidate[] = [
    makeCandidate({ id: "civic-2015", brand: "Honda", model: "Civic", yearModel: 2015 }),
    makeCandidate({ id: "hrv-2016", brand: "Honda", model: "HR-V", yearModel: 2016 }),
    makeCandidate({ id: "duster-2014", brand: "Renault", model: "Duster", yearModel: 2014 }),
  ];

  const pickedFromThree = selectSimilarVehiclesForSoldSlug(
    three,
    parseSoldVehicleSlug(`honda-civic-2014-${SAMPLE_CUID}`),
    4,
  );
  assert.deepEqual(
    pickedFromThree.map((v) => v.id),
    ["civic-2015", "hrv-2016"],
  );

  const pickedFromOne = selectSimilarVehiclesForSoldSlug(
    [three[0]!],
    parseSoldVehicleSlug(`toyota-yaris-2022-${SAMPLE_CUID}`),
    4,
  );
  assert.deepEqual(
    pickedFromOne.map((v) => v.id),
    ["civic-2015"],
  );
});

test("sem mesma marca no estoque, prioriza ano mais próximo e depois mais recentes", () => {
  const stock: SoldFallbackCandidate[] = [
    makeCandidate({ id: "antigo-2012", brand: "Fiat", model: "Palio", yearModel: 2012, createdAt: "2026-10-15T12:00:00.000Z" }),
    makeCandidate({ id: "novo-2022-velho", brand: "Hyundai", model: "HB20", yearModel: 2022, createdAt: "2026-08-01T12:00:00.000Z" }),
    makeCandidate({ id: "novo-2022-recente", brand: "Chevrolet", model: "Onix", yearModel: 2022, createdAt: "2026-10-20T12:00:00.000Z" }),
    makeCandidate({ id: "perto-2021", brand: "Volkswagen", model: "Polo", yearModel: 2021, createdAt: "2026-09-10T12:00:00.000Z" }),
    makeCandidate({ id: "perto-2023", brand: "Renault", model: "Kwid", yearModel: 2023, createdAt: "2026-10-01T12:00:00.000Z" }),
  ];

  const parsed = parseSoldVehicleSlug(`toyota-yaris-xl-plus-2022-${SAMPLE_CUID}`);
  const picked = selectSimilarVehiclesForSoldSlug(stock, parsed, 4);

  assert.deepEqual(
    picked.map((v) => v.id),
    ["novo-2022-recente", "novo-2022-velho", "perto-2023", "perto-2021"],
  );
});

test("slug de lixo devolve os 4 disponíveis mais recentes e estoque vazio devolve array vazio", () => {
  const stock: SoldFallbackCandidate[] = [
    makeCandidate({ id: "v1", createdAt: "2026-01-01T00:00:00.000Z" }),
    makeCandidate({ id: "v2", createdAt: "2026-05-01T00:00:00.000Z" }),
    makeCandidate({ id: "v3", createdAt: "2026-04-01T00:00:00.000Z" }),
    makeCandidate({ id: "v4", createdAt: "2026-03-01T00:00:00.000Z" }),
    makeCandidate({ id: "v5", createdAt: "2026-06-01T00:00:00.000Z" }),
  ];

  const picked = selectSimilarVehiclesForSoldSlug(
    stock,
    parseSoldVehicleSlug("toyota-lixo-2022"),
    4,
  );
  assert.deepEqual(
    picked.map((v) => v.id),
    ["v5", "v2", "v3", "v4"],
  );

  assert.deepEqual(
    selectSimilarVehiclesForSoldSlug([], parseSoldVehicleSlug("toyota-yaris-2022"), 4),
    [],
  );
});
