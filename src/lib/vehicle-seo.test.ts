import assert from "node:assert/strict";
import { test } from "node:test";
import { vehiclePhotoAlt, vehicleSeoDescription } from "./format";
import { vehicleSeoTitle } from "./vehicle-seo";

const civic = { brand: "Honda", model: "Civic", version: "LXR 2.0", yearModel: 2015, year: 2015, price: 74900, km: 106000, transmission: "Automático" };

test("título e descrição incluem marca, modelo, versão, ano, preço e seminovo ES", () => {
  for (const text of [vehicleSeoTitle(civic), vehicleSeoDescription(civic)]) {
    assert.match(text, /Honda Civic LXR 2\.0 2015/);
    assert.match(text, /R\$\s*74\.900/);
    assert.match(text, /seminovo ES/);
    assert.match(text, /Garagem/);
  }
  assert.ok(vehicleSeoDescription(civic).length <= 160);
});

test("versão, ano e preço diferenciam os metadados de cada anúncio", () => {
  for (const variant of [{ version: "EXR 2.0" }, { year: 2016, yearModel: 2016 }, { price: 79900 }]) {
    assert.notEqual(vehicleSeoTitle(civic), vehicleSeoTitle({ ...civic, ...variant }));
    assert.notEqual(vehicleSeoDescription(civic), vehicleSeoDescription({ ...civic, ...variant }));
  }
});

test("versão longa mantém identificação, ano e preço completos", () => {
  const input = { ...civic, brand: "Mercedes-Benz", model: "Classe C 180", version: "Avantgarde Turbo Série Especial" };
  for (const text of [vehicleSeoTitle(input), vehicleSeoDescription(input)]) {
    assert.match(text, /Avantgarde Turbo Série Especial 2015/);
    assert.match(text, /R\$\s*74\.900/);
    assert.match(text, /seminovo ES/);
  }
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
    assert.match(text, /Honda Civic LXR 2\.0 2015 \(vendido\)/);
    assert.match(text, /seminovo ES/);
    assert.doesNotMatch(text, /R\$|74[.,]?900/);
  }
  assert.match(vehicleSeoDescription(sold), /similares disponíveis/);
});

test("alt identifica o veículo e a posição real da foto sem inventar ângulo", () => {
  assert.equal(vehiclePhotoAlt("Honda Civic LXR 2.0 2015 · Prata", 0, 3), "Honda Civic LXR 2.0 2015 · Prata - foto 1 de 3");
});
