import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { HeroSearch } from "@/components/site/HeroSearch";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("HeroSearch exibe chips de alta procura (Automático, SUVs, Motos) com alvo >= 44px em toque", () => {
  const html = renderToStaticMarkup(createElement(HeroSearch, { brands: ["honda", "fiat"] }));

  assert.match(html, /href="\/estoque\?transmission=automatico"[^>]*>Automático<\/a>/);
  assert.match(html, /href="\/estoque\?body=suv"[^>]*>SUVs<\/a>/);
  assert.match(html, /href="\/estoque\?category=moto"[^>]*>Motos<\/a>/);

  const heroSearchSrc = readSrc("components/site/HeroSearch.tsx");
  assert.match(heroSearchSrc, /min-h-\[44px\]/);
  assert.match(heroSearchSrc, /pointer:coarse\)\]:!min-h-\[44px\]/);
  assert.match(heroSearchSrc, /pointer:coarse\)\]:!h-auto/);
});

test("VehicleCard não aplica aria-label no link principal e mantém alt vazio na foto", () => {
  const vehicleCardSrc = readSrc("components/site/VehicleCard.tsx");
  const stockLinkBlock = vehicleCardSrc.slice(
    vehicleCardSrc.indexOf("<StockVehicleLink"),
    vehicleCardSrc.indexOf("<div className=\"listing-card-photo"),
  );
  assert.doesNotMatch(stockLinkBlock, /aria-label=/);
  assert.match(vehicleCardSrc, /<VehicleImage[\s\S]*?alt=""/);
});

test("StatsBar ordena <dt> antes de <dd> com flex-col-reverse", () => {
  const statsBarSrc = readSrc("components/site/StatsBar.tsx");
  assert.match(statsBarSrc, /flex-col-reverse/);
  const dtIndex = statsBarSrc.indexOf("<dt");
  const ddIndex = statsBarSrc.indexOf("<dd");
  assert.ok(dtIndex > 0 && ddIndex > 0);
  assert.ok(dtIndex < ddIndex, "<dt> deve vir antes de <dd> no DOM");
});
