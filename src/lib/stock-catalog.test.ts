import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

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
  assert.doesNotMatch(links, /sr-only|hidden|display:\s*none/);

  const list = readSrc("components/site/StockInfiniteList.tsx");
  assert.match(list, /params\.set\("page"/);
  assert.match(list, /params\.set\("pageSize"/);

  const loader = readSrc("lib/vehicles.ts");
  assert.match(loader, /PUBLIC_SITEMAP_VEHICLE_WHERE/);
  assert.match(loader, /stock-catalog-links-v1/);
  assert.match(loader, /createdAt:\s*"desc"/);
});
