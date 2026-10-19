import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CITIES_DIRECTORY_PATH,
} from "@/lib/service-cities";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("rodapé troca a lista de cidades por um único link Ver cidades", () => {
  const footer = readSrc("components/site/SiteFooter.tsx");
  const links = footer.match(/Ver cidades/g) ?? [];

  assert.equal(CITIES_DIRECTORY_PATH, "/seminovos");
  assert.equal(links.length, 2);
  assert.match(footer, /CITIES_DIRECTORY_PATH/);
  assert.doesNotMatch(footer, /SERVICE_CITIES/);
  assert.doesNotMatch(footer, /Todas as cidades/);
  assert.doesNotMatch(footer, /Seminovos em \{/);
});

test("/cidades redireciona permanentemente para o hub canônico", async () => {
  const { default: config } = await import(new URL("../../next.config.mjs", import.meta.url).href);
  const redirects = await config.redirects();
  assert.deepEqual(redirects.find((redirect: { source: string }) => redirect.source === "/cidades"), {
    source: "/cidades", destination: "/seminovos", statusCode: 301,
  });
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

  assert.doesNotMatch(sitemap, /CITIES_DIRECTORY_PATH|["']\/cidades["']/);
  assert.match(sitemap, /\/seminovos\/\$\{city\.slug\}/);
});

test("hub de seminovos tem canonical e Open Graph na mesma URL", async () => {
  const { metadata } = await import("@/app/(site)/seminovos/page");
  assert.equal(metadata?.alternates?.canonical, "/seminovos");
  assert.equal(metadata?.openGraph?.url, "https://www.suagaragem.net/seminovos");
});
