import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SERVICE_CITIES,
  getServiceCity,
  otherServiceCities,
} from "./service-cities";

const EXPECTED = [
  "aracruz",
  "vitoria",
  "linhares",
  "serra",
  "vila-velha",
  "guarapari",
  "cachoeiro-de-itapemirim",
  "colatina",
  "cariacica",
  "viana",
];

test("cidades de atendimento cobrem Grande Vitória, litoral e interior", () => {
  assert.deepEqual(
    SERVICE_CITIES.map((city) => city.slug),
    EXPECTED,
  );
  assert.equal(getServiceCity("guarapari")?.name, "Guarapari");
  assert.equal(getServiceCity("cachoeiro-de-itapemirim")?.name, "Cachoeiro de Itapemirim");
  assert.equal(getServiceCity("inexistente"), null);
  assert.equal(otherServiceCities("serra").length, SERVICE_CITIES.length - 1);
});

test("slugs são únicos e o texto não inventa loja física", () => {
  const slugs = SERVICE_CITIES.map((city) => city.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const city of SERVICE_CITIES) {
    const blob = `${city.lead} ${city.paragraphs.join(" ")}`;
    assert.match(blob, /loja digital|WhatsApp|site/i);
  }
});
