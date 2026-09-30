import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("cidade do veículo entra no filtro, na API e no chip mobile", () => {
  const filters = readSrc("components/site/StockFilters.tsx");
  const browse = readSrc("components/site/EstoqueBrowse.tsx");
  const vehicles = readSrc("lib/vehicles.ts");
  const where = vehicles.slice(
    vehicles.indexOf("function buildStockWhere"),
    vehicles.indexOf("function stockQueryKey"),
  );

  assert.match(filters, /VEHICLE_LOCATION_CITIES/);
  assert.match(filters, /sticky-city-/);
  assert.match(filters, /Onde o veículo está/);
  assert.match(browse, /"city"/);
  assert.match(where, /stockCityFilter\(filters\.city\)/);
  assert.match(vehicles, /stock-page-v9/);
  assert.doesNotMatch(filters, /Vitória/);
});

test("landing de cidade não promete estoque local onde o carro não está", () => {
  const page = readSrc("app/(site)/seminovos/[cidade]/page.tsx");
  assert.match(page, /cityPageStockCopy/);
  assert.doesNotMatch(page, /Ver todos em/);
  assert.match(page, /stock\.stockHref/);
  assert.match(page, /showWhatsApp=\{false\}/);
  assert.doesNotMatch(page, /estão em \$\{city\.name\}/);
  const vehicles = readSrc("lib/vehicles.ts");
  const showcase = vehicles.slice(
    vehicles.indexOf("async function fetchCityShowcaseVehicles"),
    vehicles.indexOf("const loadCityShowcaseCached"),
  );
  assert.match(showcase, /cityShowcaseStockCity\(slug\)/);
  assert.doesNotMatch(showcase, /stockCityFilter\(slug\)/);
});

test("hero mobile não gasta blur largo nem empurra o estoque com padding morto", () => {
  const css = readSrc("app/globals.css");
  const marker = css.indexOf("Sem blur largo no celular");
  const orb = css.slice(marker, marker + 220);
  assert.match(orb, /filter:\s*none/);
  const search = readSrc("components/site/HeroSearch.tsx");
  assert.match(search, /sm:backdrop-blur-md/);
  assert.doesNotMatch(search, /backdrop-blur-md transition/);
});
