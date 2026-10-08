import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasPublishablePrice,
  localBusinessJsonLd,
  pageCanonicalPath,
  vehicleAvailabilityUrl,
  vehicleJsonLd,
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

test("Google recebe fotos públicas no domínio canônico e mantém imagens externas", () => {
  const data = vehicleJsonLd({ ...hb20, photos: [
    { url: "https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/car.webp" },
    { url: "https://cdn.example/hb20.webp" },
  ] }) as { image: string[] };
  assert.deepEqual(data.image, ["https://www.suagaragem.net/fotos/v1/original/car.webp", "https://cdn.example/hb20.webp"]);
});
