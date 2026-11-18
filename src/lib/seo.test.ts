import assert from "node:assert/strict";
import { test } from "node:test";
import { getServiceCity } from "./service-cities";
import {
  VEHICLE_SELLER_AREA_SERVED,
  hasPublishablePrice,
  localBusinessJsonLd,
  pageCanonicalPath,
  serviceCityJsonLd,
  vehicleAvailabilityUrl,
  vehicleJsonLd,
  vehicleSchemaTransmission,
} from "./seo";

const hb20 = {
  id: "cmtseo0000000000000000001",
  brand: "Hyundai",
  model: "HB20",
  version: "evolution 1.0",
  year: 2021,
  yearModel: 2022,
  km: 68450,
  price: 64900,
  fuel: "Flex",
  transmission: "Manual",
  color: "Prata",
  description: "Seminovo com procedência.",
  status: "disponivel",
  category: "carro",
  engine: "1.0 12V",
  doors: 4,
  photos: [{ url: "https://cdn.example/hb20.webp" }],
};

test("canonical de página não duplica barra nem inventa host", () => {
  assert.equal(pageCanonicalPath("/"), "/");
  assert.equal(pageCanonicalPath("/estoque"), "/estoque");
  assert.equal(pageCanonicalPath("faq"), "/faq");
});

test("JSON-LD do anúncio traz preço, km e disponibilidade sem FIPE", () => {
  const data = vehicleJsonLd(hb20) as Record<string, unknown>;
  const offers = data.offers as Record<string, unknown>;
  const mileage = data.mileageFromOdometer as Record<string, unknown>;
  assert.equal(data["@type"], "Car");
  assert.equal(offers.price, 64900);
  assert.equal(offers.priceCurrency, "BRL");
  assert.equal(offers.availability, vehicleAvailabilityUrl("disponivel"));
  assert.equal(mileage.value, 68450);
  assert.equal(mileage.unitCode, "KMT");
  assert.equal(data.sku, hb20.id);
  assert.equal("fipePrice" in data, false);
  assert.doesNotMatch(JSON.stringify(data), /fipe/i);
  assert.equal(hasPublishablePrice(0), false);

  const sold = vehicleJsonLd({ ...hb20, status: "vendido", price: 64900 });
  const soldOffers = (sold as { offers: Record<string, unknown> }).offers;
  assert.equal(soldOffers.availability, vehicleAvailabilityUrl("vendido"));
  assert.equal("price" in soldOffers, false);
});

test("a loja não usa Aracruz como cidade padrão e publica um telefone só", () => {
  const data = localBusinessJsonLd() as {
    address: { addressLocality: string };
    telephone: string[];
  };
  assert.equal(data.address.addressLocality, "Linhares");
  assert.notEqual(data.address.addressLocality, "Aracruz");
  assert.deepEqual(data.telephone, ["+5527996330706"]);
});

test("cobertura do norte do ES inclui São Mateus e Sooretama sem mudar o endereço", () => {
  const data = localBusinessJsonLd() as {
    areaServed: { name: string; "@type": string }[];
    address: { addressLocality: string; addressRegion: string; addressCountry: string };
  };
  for (const slug of ["sao-mateus", "sooretama"]) {
    const city = getServiceCity(slug);
    assert.ok(city);
    assert.ok(data.areaServed.some(area => area["@type"] === "City" && area.name === city.name));
    const page = serviceCityJsonLd(city);
    assert.equal(page.url, `https://www.suagaragem.net/seminovos/${slug}`);
    assert.equal(page.about.name, city.name);
    assert.equal(page.provider.areaServed.name, city.name);
    assert.equal("address" in page.provider, false);
  }
  assert.equal(data.address.addressLocality, "Linhares");
  assert.equal(data.address.addressRegion, "ES");
  assert.equal(data.address.addressCountry, "BR");
});

test("Google recebe fotos públicas no domínio canônico e mantém imagens externas", () => {
  const data = vehicleJsonLd({ ...hb20, photos: [
    { url: "https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/car.webp" },
    { url: "https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/car.webp" },
    { url: "https://cdn.example/hb20.webp" },
  ] }) as { image: string[]; mainEntityOfPage: { "@type": string; "@id": string }; inLanguage: string; url: string };
  assert.deepEqual(data.image, ["https://www.suagaragem.net/fotos/v1/1280-contain-q78/car.webp", "https://cdn.example/hb20.webp"]);
  assert.deepEqual(data.mainEntityOfPage, { "@type": "WebPage", "@id": data.url });
  assert.equal(data.inLanguage, "pt-BR");
});

test("JSON-LD do veículo traz versão e não inventa prazo de validade da oferta", () => {
  const data = vehicleJsonLd({ ...hb20, version: "Comfort 1.0" }) as {
    vehicleConfiguration?: string;
    offers: Record<string, unknown>;
  };
  assert.equal(data.vehicleConfiguration, "Comfort 1.0");
  assert.equal("priceValidUntil" in data.offers, false);
  const sold = vehicleJsonLd({ ...hb20, status: "vendido" }) as { offers: Record<string, unknown> };
  assert.equal("price" in sold.offers, false);
  assert.equal("priceValidUntil" in sold.offers, false);
});

test("JSON-LD sanitiza quebras de linha brutas na descrição do veículo", () => {
  const data = vehicleJsonLd({
    ...hb20,
    description: "Carro completo.\r\n\r\nÚnico dono.\r\n\r\nRevisões em dia.",
  }) as { description?: string };
  assert.equal(data.description, "Carro completo. Único dono. Revisões em dia.");
  assert.doesNotMatch(data.description ?? "", /\r|\n/);
});


test("JSON-LD completo preserva dados reais e usa Car ou Motorcycle como subtipos de Vehicle", () => {
  const data = vehicleJsonLd(hb20);
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@id"], `${data.url}#veiculo`);
  assert.equal(data.name, "Hyundai HB20 Evolution 1.0 2022");
  assert.deepEqual(data.brand, { "@type": "Brand", name: "Hyundai" });
  assert.equal(data.model, "HB20");
  assert.equal(data.vehicleModelDate, "2022");
  assert.equal(data.productionDate, "2021");
  assert.equal(data.color, "Prata");
  assert.equal(data.fuelType, "Flex");
  assert.equal(data.vehicleTransmission, "Manual");
  assert.equal(data.numberOfDoors, 4);
  assert.deepEqual(data.vehicleEngine, { "@type": "EngineSpecification", name: "1.0 12V" });
  assert.deepEqual(data.image, [hb20.photos[0].url]);
  assert.equal(data.offers.url, data.url);
  assert.equal(data.offers["@type"], "Offer");
  assert.equal(data.offers.itemCondition, "https://schema.org/UsedCondition");
  assert.equal((data.offers.seller as { name: string }).name, "Garagem");
  assert.equal(vehicleJsonLd({ ...hb20, category: "moto" })["@type"], "Motorcycle");
  assert.equal("aggregateRating" in data, false);
});

test("vendido remove preço da descrição e da oferta; campos ausentes não são inventados", () => {
  const data = vehicleJsonLd({ ...hb20, status: "vendido", description: "Preço: 64900", photos: [], engine: null, doors: null, color: null });
  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /64900|price|R\$|locationCity|aggregateRating/);
  assert.equal(data.offers.availability, "https://schema.org/OutOfStock");
  assert.match(data.description!, /vendido/);
  assert.equal("image" in data, false);
  assert.equal("vehicleEngine" in data, false);
  assert.equal("numberOfDoors" in data, false);
  assert.equal("color" in data, false);
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const offers = vehicleJsonLd({ ...hb20, price }).offers;
    assert.equal("price" in offers, false);
    assert.equal("priceCurrency" in offers, false);
  }
});

test("JSON-LD da home não duplica a UF no endereço do depoimento", () => {
  const data = localBusinessJsonLd(undefined, [
    { name: "Ana", city: "Linhares, ES", rating: 5, message: "Ótimo atendimento" },
    { name: "Beto", city: "Colatina", rating: 5, message: "Recomendo" },
  ] as never) as { review: { author: { address: { name: string } } }[] };
  assert.deepEqual(
    data.review.map((item) => item.author.address.name),
    ["Linhares, ES", "Colatina, ES"],
  );
});

test("vehicleSchemaTransmission aceita apenas Manual, Automático, CVT ou Xtronic sem marchas nem cv", () => {
  assert.equal(vehicleSchemaTransmission("Manual 5 marchas 82cv", "1.0 Flex"), "Manual");
  assert.equal(vehicleSchemaTransmission("Mecânico 6 marchas", null), "Manual");
  assert.equal(vehicleSchemaTransmission("Automático 6 marchas 155cv", "LXR 2.0"), "Automático");
  assert.equal(vehicleSchemaTransmission("AT6", null), "Automático");
  assert.equal(vehicleSchemaTransmission("Automatizado Dualogic 5 marchas", null), "Automático");
  assert.equal(vehicleSchemaTransmission("Semi-automático 4 marchas", null), "Automático");
  assert.equal(vehicleSchemaTransmission("CVT 7 marchas simuladas 177cv", null), "CVT");
  assert.equal(vehicleSchemaTransmission("CVT Xtronic 6 marchas 120cv", null), "Xtronic");
  assert.equal(vehicleSchemaTransmission("Automático", "SL 2.0 X-Tronic"), "Xtronic");
  assert.equal(vehicleSchemaTransmission("Manual", "1.6 MSI Automático"), "Automático");
  assert.equal(vehicleSchemaTransmission("6 marchas 120cv", "1.6 Flex"), undefined);
  assert.equal(vehicleSchemaTransmission("", null), undefined);
});

test("JSON-LD inclui seller AutoDealer com areaServed (Linhares, Aracruz e Grande Vitória) e disponibilidade reservado/vendido", () => {
  const available = vehicleJsonLd(hb20);
  const seller = available.offers.seller as {
    "@type": string;
    name: string;
    areaServed: Array<{ "@type": string; name: string }>;
  };
  assert.equal(seller["@type"], "AutoDealer");
  assert.equal(seller.name, "Garagem");
  assert.deepEqual(
    seller.areaServed.map((item) => item.name),
    ["Linhares", "Aracruz", "Grande Vitória"],
  );
  assert.equal(VEHICLE_SELLER_AREA_SERVED.length, 3);

  const reserved = vehicleJsonLd({ ...hb20, status: "reservado" });
  assert.equal(reserved.offers.availability, "https://schema.org/OutOfStock");
  assert.equal(reserved.offers.price, 64900);
  assert.equal(reserved.offers.priceCurrency, "BRL");

  const sold = vehicleJsonLd({ ...hb20, status: "vendido" });
  assert.equal(sold.offers.availability, "https://schema.org/OutOfStock");
  assert.equal("price" in sold.offers, false);
});

test("JSON-LD nunca expõe parcelas, placa, chassi, RENAVAM, marchas, cv nem termos antigos", () => {
  const dirtyInput = {
    ...hb20,
    version: "Comfort 1.0",
    engine: "1.0 12V 80cv 5 marchas",
    transmission: "Manual 5 marchas 80cv",
    plate: "XYZ-0000",
    plateEnd: "0",
    chassis: "9BWZZZ000VT000000",
    renavam: "12345678900",
    fipePrice: 67000,
    locationCity: "serra",
    photos: [{ url: "http://cdn.example/hb20-frente.jpg" }],
    description: [
      "Seminovo revisado e periciado.",
      "Entrada de R$ 10.000 + 48x de R$ 1.290.",
      "Parcelas a partir de R$ 990.",
      "Placa XYZ0A00 e XYZ-0000.",
      "Chassi 9BWZZZ000VT000000.",
      "RENAVAM 12345678900.",
      "Loja digital com atendimento com hora marcada.",
    ].join("\n"),
  };

  const data = vehicleJsonLd(dirtyInput);
  const serialized = JSON.stringify(data);

  assert.equal(data.vehicleTransmission, "Manual");
  assert.deepEqual(data.vehicleEngine, { "@type": "EngineSpecification", name: "1.0 12V" });
  assert.deepEqual(data.image, ["https://cdn.example/hb20-frente.jpg"]);
  assert.equal(data.description, "Seminovo revisado e periciado.");
  assert.doesNotMatch(
    serialized,
    /XYZ-?0000|XYZ0A00|9BWZZZ000VT000000|12345678900|48x|1\.290|\b990\b|parcela|placa|chassi|renavam|80\s*cv|marchas|fipe|67000|serra|loja digital|hora marcada/i,
  );
});
