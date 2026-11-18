import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CityDirectory } from "@/components/site/CityDirectory";
import { SeoInternalLinks } from "@/components/site/SeoInternalLinks";
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
  for (const href of [
    "/seminovos/linhares",
    "/seminovos/aracruz",
    "/seminovos/grande-vitoria",
  ]) {
    assert.ok(footer.includes(href), `rodapé deve linkar ${href}`);
  }
  assert.match(footer, /Atendemos Linhares, Aracruz e Grande Vitória/);
  assert.match(footer, /Combinamos o atendimento pelo WhatsApp/);
});

test("SeoInternalLinks conecta Linhares, Aracruz, Grande Vitória, Vitória e financiamento", () => {
  const html = renderToStaticMarkup(createElement(SeoInternalLinks));
  for (const href of [
    "/seminovos/linhares",
    "/seminovos/aracruz",
    "/seminovos/grande-vitoria",
    "/seminovos/vitoria",
    "/seminovos/serra",
    "/seminovos/vila-velha",
    "/seminovos/colatina",
    "/financiamento",
  ]) {
    assert.match(html, new RegExp(`href="${href}"`), href);
  }
});

test("hubs /seminovos e /cidades têm WhatsAppButton com SiteLeadHit e copy regional limpa", () => {
  for (const rel of ["app/(site)/seminovos/page.tsx", "app/(site)/cidades/page.tsx"]) {
    const src = readSrc(rel);
    assert.match(src, /<SiteLeadHit\b[^>]*>[\s\S]*?<WhatsAppButton\b/, rel);
    assert.match(src, /Atendemos Linhares, Aracruz e Grande Vitória/, rel);
    assert.match(src, /combinamos o atendimento pelo WhatsApp/i, rel);
    assert.doesNotMatch(
      src,
      /loja física|loja digital|pontos de venda|ponto de venda|ponto físico|hora marcada/i,
      rel,
    );
  }
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

  const buttonClasses = [...html.matchAll(/class="([^"]*min-h-16[^"]*)"/g)].map(
    (match) => match[1],
  );
  assert.equal(buttonClasses.length, SERVICE_CITIES.length);
  assert.equal(new Set(buttonClasses).size, 1);
});

test("páginas de cidade e a vitrine delas continuam no ar", () => {
  const cityPage = readSrc("app/(site)/seminovos/[cidade]/page.tsx");
  const sitemap = readSrc("app/sitemap.ts");

  assert.match(cityPage, /getCityShowcaseVehicles\(\)/);
  assert.match(cityPage, /vehicles=\{featured\.slice\(0, 6\)\}/);
  assert.match(cityPage, /CITIES_DIRECTORY_PATH/);
  assert.match(cityPage, /Ver cidades/);
  assert.doesNotMatch(cityPage, /Todas as cidades/);
  assert.doesNotMatch(cityPage, /otherServiceCities/);

  assert.match(sitemap, /CITIES_DIRECTORY_PATH/);
  assert.match(sitemap, /\/seminovos\/\$\{city\.slug\}/);
});
