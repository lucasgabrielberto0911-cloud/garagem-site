import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CityDirectory } from "@/components/site/CityDirectory";
import {
  CITIES_DIRECTORY_PATH,
  SERVICE_CITIES,
} from "@/lib/service-cities";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("rodapé troca a lista de cidades por um único link Ver cidades", () => {
  const footer = readSrc("components/site/SiteFooter.tsx");
  const links = footer.match(/Ver cidades/g) ?? [];

  assert.equal(CITIES_DIRECTORY_PATH, "/cidades");
  assert.equal(links.length, 2);
  assert.match(footer, /CITIES_DIRECTORY_PATH/);
  assert.doesNotMatch(footer, /SERVICE_CITIES/);
  assert.doesNotMatch(footer, /Todas as cidades/);
  assert.doesNotMatch(footer, /Seminovos em \{/);
});

test("página de cidades só lista botões para as páginas que já existem", () => {
  const page = readSrc("app/(site)/cidades/page.tsx");
  const html = renderToStaticMarkup(createElement(CityDirectory));

  assert.match(page, /<CityDirectory/);
  assert.doesNotMatch(page, /Todas as cidades/);
  assert.doesNotMatch(page, /VehicleGrid|getCityShowcaseVehicles|getFeaturedVehicles/);
  assert.doesNotMatch(
    html,
    /truncate|line-clamp|whitespace-nowrap|overflow-hidden|text-ellipsis/,
  );

  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(
    hrefs,
    SERVICE_CITIES.map((city) => `/seminovos/${city.slug}`),
  );

  for (const city of SERVICE_CITIES) {
    assert.match(html, new RegExp(`Seminovos em ${city.name}`));
  }
  assert.doesNotMatch(html, /Todas as cidades/);

  const buttonClasses = [...html.matchAll(/class="([^"]*min-h-28[^"]*)"/g)].map(
    (match) => match[1],
  );
  assert.equal(buttonClasses.length, SERVICE_CITIES.length);
  assert.equal(new Set(buttonClasses).size, 1);
});

test("páginas de cidade e o estoque delas continuam no ar", () => {
  const cityPage = readSrc("app/(site)/seminovos/[cidade]/page.tsx");
  const sitemap = readSrc("app/sitemap.ts");

  assert.match(cityPage, /getCityShowcaseVehicles\(\)/);
  assert.match(cityPage, /vehicles=\{featured\}/);
  assert.match(cityPage, /CITIES_DIRECTORY_PATH/);
  assert.match(cityPage, /Ver cidades/);
  assert.doesNotMatch(cityPage, /Todas as cidades/);
  assert.doesNotMatch(cityPage, /otherServiceCities/);

  assert.match(sitemap, /CITIES_DIRECTORY_PATH/);
  assert.match(sitemap, /\/seminovos\/\$\{city\.slug\}/);
});
