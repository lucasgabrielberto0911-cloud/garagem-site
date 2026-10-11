import assert from "node:assert/strict";
import { test } from "node:test";
import { vehicleSeoDescription } from "./format";
import {
  VEHICLE_SEO_LOCATION,
  VEHICLE_SEO_TITLE_MAX,
  vehicleSeoTitle,
} from "./vehicle-seo";

test("título da ficha inclui versão, região de atendimento e marca Garagem", () => {
  assert.equal(
    vehicleSeoTitle({ brand: "Honda", model: "City", version: "EXL", yearModel: 2018 }),
    "Honda City EXL 2018 em Linhares/ES | Garagem",
  );
  assert.equal(VEHICLE_SEO_LOCATION, "Linhares/ES");
});

test("título sem versão não deixa espaço duplo", () => {
  assert.equal(
    vehicleSeoTitle({ brand: "Fiat", model: "Uno", version: null, yearModel: 2015 }),
    "Fiat Uno 2015 em Linhares/ES | Garagem",
  );
});

test("título vendido mantém (vendido), sem região e sem preço", () => {
  const title = vehicleSeoTitle({
    brand: "Honda",
    model: "City",
    version: "EXL",
    yearModel: 2018,
    sold: true,
  });
  assert.equal(title, "Honda City EXL 2018 (vendido) | Garagem");
  assert.doesNotMatch(title, /R\$|Linhares/);
});

test("versão longa é cortada por palavras e o título cabe no limite", () => {
  const title = vehicleSeoTitle({
    brand: "Volkswagen",
    model: "Gol",
    version: "1.6 MSI Highline Total Flex Automatizado Plus",
    yearModel: 2020,
  });
  assert.ok(title.length <= VEHICLE_SEO_TITLE_MAX, title);
  assert.match(title, /^Volkswagen Gol 1\.6 .*2020 em Linhares\/ES \| Garagem$/);
  assert.doesNotMatch(title, /Plus/);
});

test("sem espaço nem para marca/modelo/ano + região, abre mão da região", () => {
  const title = vehicleSeoTitle({
    brand: "Mercedes-Benz",
    model: "Classe C 180 Avantgarde",
    version: "Turbo",
    yearModel: 2019,
  });
  assert.doesNotMatch(title, /Linhares/);
  assert.match(title, /2019 \| Garagem$/);
});

test("descrição usa a região de atendimento quando informada", () => {
  const description = vehicleSeoDescription({
    brand: "Honda",
    model: "City",
    year: 2018,
    price: 79900,
    km: 60000,
    transmission: "Automático",
    location: VEHICLE_SEO_LOCATION,
  });
  assert.match(description, /à venda em Linhares\/ES por /);
  assert.ok(description.length <= 155);
});

test("descrição de vendido não leva preço nem região", () => {
  const description = vehicleSeoDescription({
    brand: "Honda",
    model: "City",
    year: 2018,
    price: 79900,
    km: 60000,
    transmission: "Automático",
    sold: true,
    location: VEHICLE_SEO_LOCATION,
  });
  assert.doesNotMatch(description, /R\$|Linhares/);
  assert.match(description, /vendido/);
});
