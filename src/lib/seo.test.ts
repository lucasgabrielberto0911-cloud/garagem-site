import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasPublishablePrice,
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

  const sold = vehicleJsonLd({ ...hb20, status: "vendido", price: 0 });
  const soldOffers = (sold as { offers: Record<string, unknown> }).offers;
  assert.equal(soldOffers.availability, vehicleAvailabilityUrl("vendido"));
  assert.equal("price" in soldOffers, false);
});
