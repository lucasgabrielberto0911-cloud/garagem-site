import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cityPageStockCopy,
  cityShowcaseOffset,
  cityShowcaseStockCity,
  pickCityShowcase,
  rotateItems,
} from "./city-showcase";

test("cidades diferentes começam o recorte em pontos diferentes", () => {
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const serra = pickCityShowcase(items, "serra", 8);
  const vitoria = pickCityShowcase(items, "vitoria", 8);
  assert.equal(serra.length, 8);
  assert.equal(vitoria.length, 8);
  assert.notDeepEqual(serra, vitoria);
  assert.deepEqual(rotateItems([1, 2, 3], 1), [2, 3, 1]);
  assert.equal(cityShowcaseOffset("serra", 10) !== cityShowcaseOffset("vitoria", 10), true);
});

test("Serra lista só Serra; as outras cidades usam Linhares, nunca Aracruz", () => {
  assert.equal(cityShowcaseStockCity("serra"), "serra");
  assert.equal(cityShowcaseStockCity("Serra"), "serra");
  assert.equal(cityShowcaseStockCity("linhares"), "linhares");
  assert.equal(cityShowcaseStockCity("colatina"), "linhares");
  assert.equal(cityShowcaseStockCity("vitoria"), "linhares");
  assert.equal(cityShowcaseStockCity("aracruz"), "linhares");
  assert.notEqual(cityShowcaseStockCity("aracruz"), "aracruz");
});

test("a landing leva a um anúncio real e o WhatsApp é vídeo ou visita", () => {
  const colatina = cityPageStockCopy("colatina", "Colatina");
  assert.equal(colatina.stockCity, "linhares");
  assert.equal(colatina.stockHref, "/estoque?city=linhares");
  assert.match(colatina.intro, /Linhares/);
  assert.match(colatina.intro, /ficha/i);
  assert.match(colatina.whatsappMessage, /vídeo/i);
  assert.match(colatina.whatsappMessage, /visita/i);
  assert.match(colatina.whatsappMessage, /Colatina/);
  assert.equal(colatina.linkSerra, true);
  assert.doesNotMatch(colatina.intro, /Aracruz/);
  assert.doesNotMatch(colatina.intro, /Mobi|Palio|Civic|Biz/);
  assert.match(colatina.empty, /não tem veículo disponível em Linhares/i);

  const aracruz = cityPageStockCopy("aracruz", "Aracruz");
  assert.equal(aracruz.stockCity, "linhares");
  assert.equal(aracruz.stockHref, "/estoque?city=linhares");
  assert.match(aracruz.intro, /Linhares/);
  assert.doesNotMatch(aracruz.intro, /estão em Aracruz|cidade é Aracruz/);

  const serra = cityPageStockCopy("serra", "Serra");
  assert.equal(serra.stockCity, "serra");
  assert.equal(serra.stockHref, "/estoque?city=serra");
  assert.match(serra.intro, /Serra/);
  assert.match(serra.intro, /ficha/i);
  assert.match(serra.whatsappMessage, /vídeo|visita/i);
  assert.equal(serra.linkLinhares, true);
  assert.equal(serra.linkSerra, false);
  assert.doesNotMatch(serra.intro, /Linhares/);

  const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const page = readFileSync(
    join(srcRoot, "app/(site)/seminovos/[cidade]/page.tsx"),
    "utf8",
  );
  const vehicles = readFileSync(join(srcRoot, "lib/vehicles.ts"), "utf8");
  assert.match(page, /getCityShowcaseVehicles/);
  assert.match(page, /cityPageStockCopy/);
  assert.match(page, /showWhatsApp=\{false\}/);
  assert.match(page, /Pedir vídeo ou visita/);
  assert.doesNotMatch(page, /Estou em \$\{city\.name\}/);
  assert.match(vehicles, /cityShowcaseStockCity\(slug\)/);
  assert.match(vehicles, /locationCity/);
  assert.doesNotMatch(
    vehicles.slice(vehicles.indexOf("async function fetchCityShowcaseVehicles")),
    /stockCityFilter\(slug\)/,
  );
});
