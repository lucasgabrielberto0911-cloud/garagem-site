import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingPreview } from "@/components/admin/ListingPreview";
import { uniqueOptions } from "@/lib/admin-brand-model-options";

const base = {
  brand: "volkswagen",
  model: "golf",
  version: "GTI 2.0 TSI",
  yearModel: 2020,
  km: 45000,
  transmission: "Automático",
  price: 120000,
  status: "disponivel",
  coverUrl: "/branding/placeholder-car.png",
};
const html = (over = {}) =>
  renderToStaticMarkup(createElement(ListingPreview, { ...base, ...over }));

test("prévia usa a foto local e mostra o preço", () => {
  const out = html();
  assert.match(out, /placeholder-car\.png/);
  assert.match(out, /120\.000/);
  assert.match(out, /2020/);
});

test("prévia de carro vendido não mostra preço", () => {
  const out = html({ status: "vendido" });
  assert.doesNotMatch(out, /120\.000|R\$/);
  assert.match(out, /Vendido/);
});

test("prévia nunca mostra cidade e avisa quando falta foto", () => {
  const out = html({ coverUrl: "", locationCity: "Linhares" });
  assert.doesNotMatch(out, /Linhares/);
  assert.match(out, /Sem foto de capa/);
});

test("sugestões de marca juntam repetidos e ordenam por uso", () => {
  assert.deepEqual(uniqueOptions(["Fiat", " fiat", "Honda", "Fiat", "", "Honda", "Audi"]), [
    "Fiat",
    "Honda",
    "Audi",
  ]);
});
