import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { StockCatalogLinks } from "@/components/site/StockCatalogLinks";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("estoque SSR lista cada ficha e a grade segue em lotes de 8", () => {
  const page = readSrc("app/(site)/estoque/page.tsx");
  assert.match(page, /getStockPage\(\{\s*page:\s*1\s*\}\)/);
  assert.doesNotMatch(page, /getStockPage\(\{[^}]*pageSize/);
  assert.match(page, /getStockCatalogLinks\(\)/);
  assert.match(page, /<StockCatalogLinks/);
  assert.match(page, /itemListJsonLd\(listed/);

  const links = readSrc("components/site/StockCatalogLinks.tsx");
  assert.match(links, /aria-label="Todos os anúncios"/);
  assert.match(links, /vehiclePath\(vehicle\)/);
  assert.match(links, /stock-catalog-index/);
  assert.match(links, /tabIndex=\{-1\}/);
  assert.doesNotMatch(links, /display:\s*none|aria-hidden/);

  const css = readSrc("app/globals.css");
  const hidden = css.slice(
    css.indexOf(".stock-catalog-index {"),
    css.indexOf(".stock-catalog-index {") + 280,
  );
  assert.match(hidden, /clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
  assert.match(hidden, /width:\s*1px/);
  assert.doesNotMatch(hidden, /display:\s*none/);

  const html = renderToStaticMarkup(
    createElement(StockCatalogLinks, {
      vehicles: [
        {
          id: "cmt0ewzpg0000lc0493fl02h7",
          brand: "Fiat",
          model: "Palio Weekend",
          version: null,
          yearModel: 2016,
          price: 47900,
        },
      ],
    }),
  );
  assert.match(html, /stock-catalog-index/);
  assert.match(html, /Todos os anúncios/);
  assert.match(html, /Palio Weekend/);
  assert.match(html, /47\.900/);
  assert.match(html, /href="\/estoque\/fiat-palio-weekend-2016-/);
  assert.equal(html.includes('tabindex="-1"'), true);

  const city = readSrc("app/(site)/seminovos/[cidade]/page.tsx");
  assert.match(city, /getCityShowcaseVehicles\(\)/);
  assert.match(city, /<VehicleGrid/);
  assert.doesNotMatch(city, /StockInfiniteList|pageSize/);

  const list = readSrc("components/site/StockInfiniteList.tsx");
  assert.match(list, /params\.set\("page"/);
  assert.match(list, /params\.set\("pageSize"/);

  const loader = readSrc("lib/vehicles.ts");
  assert.match(loader, /PUBLIC_SITEMAP_VEHICLE_WHERE/);
  assert.match(loader, /stock-catalog-links-v1/);
  assert.match(loader, /createdAt:\s*"desc"/);
});
