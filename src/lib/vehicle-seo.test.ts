import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { vehiclePhotoAlt, vehicleSeoDescription } from "./format";
import { VEHICLE_SEO_TITLE_MAX, vehicleSeoTitle } from "./vehicle-seo";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const civic = {
  brand: "Honda",
  model: "Civic",
  version: "LXR",
  yearModel: 2015,
  year: 2015,
  price: 74900,
  km: 106000,
  transmission: "Automático",
};

test("título e descrição incluem marca, modelo, versão, ano, preço e seminovo ES", () => {
  for (const text of [vehicleSeoTitle(civic), vehicleSeoDescription(civic)]) {
    assert.match(text, /Honda Civic LXR 2015/);
    assert.match(text, /R\$\s*74\.900/);
    assert.match(text, /seminovo ES/);
    assert.match(text, /Garagem/);
  }
  assert.ok(vehicleSeoTitle(civic).length <= VEHICLE_SEO_TITLE_MAX);
  assert.ok(vehicleSeoDescription(civic).length <= 160);
});

test("versão, ano e preço diferenciam os metadados de cada anúncio", () => {
  for (const variant of [{ version: "EXR" }, { year: 2016, yearModel: 2016 }, { price: 79900 }]) {
    assert.notEqual(vehicleSeoTitle(civic), vehicleSeoTitle({ ...civic, ...variant }));
    assert.notEqual(vehicleSeoDescription(civic), vehicleSeoDescription({ ...civic, ...variant }));
  }
});

test("versão longa corta palavras antes do sufixo para caber no limite de 60 caracteres sem perder a marca", () => {
  const input = {
    ...civic,
    brand: "Volkswagen",
    model: "Gol",
    version: "1.6 MSI Highline Total Flex Automatizado Plus",
    yearModel: 2020,
    price: 54900,
  };
  const title = vehicleSeoTitle(input);
  assert.ok(title.length <= VEHICLE_SEO_TITLE_MAX, `título excedeu ${VEHICLE_SEO_TITLE_MAX}: ${title} (${title.length})`);
  assert.match(title, /Garagem$/);
  assert.doesNotMatch(title, /Plus/);
});

test("versão longa em vendido respeita o teto de 60 caracteres e mantém (vendido)", () => {
  const input = {
    ...civic,
    brand: "Volkswagen",
    model: "Gol",
    version: "1.6 MSI Highline Total Flex Automatizado Plus",
    yearModel: 2020,
    sold: true,
  };
  const title = vehicleSeoTitle(input);
  assert.ok(title.length <= VEHICLE_SEO_TITLE_MAX, `título excedeu ${VEHICLE_SEO_TITLE_MAX}: ${title} (${title.length})`);
  assert.match(title, /\(vendido\)/);
  assert.match(title, /Garagem$/);
  assert.doesNotMatch(title, /Plus|R\$/);
});

test("sem versão ou preço publicável não há espaços duplicados nem preço fictício", () => {
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const input = { ...civic, version: null, price };
    for (const text of [vehicleSeoTitle(input), vehicleSeoDescription(input)]) {
      assert.match(text, /Honda Civic 2015/);
      assert.doesNotMatch(text, /  |R\$|NaN|Infinity/);
    }
  }
});

test("vendido preserva identificação e busca regional, sem divulgar preço antigo", () => {
  const sold = { ...civic, sold: true };
  for (const text of [vehicleSeoTitle(sold), vehicleSeoDescription(sold)]) {
    assert.match(text, /Honda Civic LXR 2015 \(vendido\)/);
    assert.match(text, /seminovo ES/);
    assert.doesNotMatch(text, /R\$|74[.,]?900/);
  }
  assert.ok(vehicleSeoTitle(sold).length <= VEHICLE_SEO_TITLE_MAX);
  assert.match(vehicleSeoDescription(sold), /similares disponíveis/);
});

test("alt identifica o veículo e a posição real da foto sem inventar ângulo", () => {
  assert.equal(vehiclePhotoAlt("Honda Civic LXR 2015 · Prata", 0, 3), "Honda Civic LXR 2015 · Prata - foto 1 de 3");
});

test("ficha Open Graph declara dimensões 1200x800, tipo image/webp e siteName", () => {
  const pageCode = readFileSync(join(srcRoot, "app/(vehicle)/estoque/[id]/page.tsx"), "utf8");
  assert.match(pageCode, /siteName:\s*site\.name/);
  assert.match(pageCode, /width:\s*1200,\s*height:\s*800,\s*type:\s*"image\/webp"/);
});
