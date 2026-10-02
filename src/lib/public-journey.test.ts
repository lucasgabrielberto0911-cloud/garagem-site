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
  const stockQuery = readSrc("lib/stock-query.ts");
  assert.match(stockQuery, /"city"/);
  assert.match(browse, /STOCK_FILTER_KEYS/);
  assert.match(browse, /city: params\.city/);
  assert.match(where, /stockCityFilter\(filters\.city\)/);
  assert.match(vehicles, /stock-page-v12/);
  assert.doesNotMatch(filters, /Vitória/);
});

test("landing de cidade lista o estoque inteiro e não filtra pela cidade", () => {
  const page = readSrc("app/(site)/seminovos/[cidade]/page.tsx");
  assert.match(page, /cityPageStockCopy/);
  assert.doesNotMatch(page, /Ver todos em/);
  assert.match(page, /stock\.stockHref/);
  assert.doesNotMatch(page, /showWhatsApp/);
  assert.match(page, /Pedir vídeo ou visita/);
  assert.doesNotMatch(page, /estão em \$\{city\.name\}/);
  assert.doesNotMatch(page, /city=serra|city=linhares/);
  const vehicles = readSrc("lib/vehicles.ts");
  const showcase = vehicles.slice(
    vehicles.indexOf("async function fetchCityShowcaseVehicles"),
    vehicles.indexOf("const loadCityShowcaseCached"),
  );
  assert.match(showcase, /status: "disponivel"/);
  assert.doesNotMatch(showcase, /locationCity|stockCityFilter|pickCityShowcase/);
});

test("filtros do estoque no celular alinham rótulo, chips e Filtros sem máscara", () => {
  const filters = readSrc("components/site/StockFilters.tsx");
  const css = readSrc("app/globals.css");
  const barStart = filters.indexOf("data-stock-filters");
  const barEnd = filters.indexOf('id="painel-filtros"');
  assert.ok(barStart > 0 && barEnd > barStart);
  const bar = filters.slice(barStart, barEnd);
  assert.match(bar, /MobileChipRow label="Cidade"/);
  assert.match(bar, /MobileChipRow label="Faixa"/);
  assert.match(bar, /label="Marca"/);
  const faixa = bar.slice(bar.indexOf('label="Faixa"'), bar.indexOf('label="Marca"'));
  assert.doesNotMatch(faixa, /stock-chip-action/);
  assert.match(bar, /stock-chip-action/);
  assert.match(bar, /Filtros/);
  assert.doesNotMatch(bar, /chip-scroll/);
  assert.match(readSrc("lib/stock-chip-track.ts"), /chipTrackInsets/);
  assert.match(filters, /Até 30 mil/);
  assert.match(filters, /Até 50 mil/);
  assert.match(filters, /50 a 80 mil/);
  assert.match(filters, /80 a 120 mil/);
  assert.match(filters, /Acima de 120 mil/);
  assert.match(css, /\.stock-chip-row\s*\{[^}]*align-items:\s*center/);
  assert.match(css, /\.stock-chip-row\s*\{[^}]*height:\s*2\.75rem/);
  assert.match(css, /\.stock-chip-action\s*\{[^}]*height:\s*2\.75rem/);
  const track = css.slice(css.indexOf(".stock-chip-track {"), css.indexOf(".stock-chip-action"));
  assert.doesNotMatch(track, /mask-image/);
  assert.doesNotMatch(filters, /Confirmado neste anúncio/);
  assert.match(readSrc("lib/site.ts"), /label: "\(27\) 99633-0706"/);
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
