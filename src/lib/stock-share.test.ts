import test from "node:test";
import assert from "node:assert/strict";
import { stockShareUrl } from "./stock-share";
import { shareVehicleLink } from "./vehicle-share";

test("busca compartilhada mantém filtros, acentos e ordem no domínio oficial", () => {
  const url = new URL(stockShareUrl("https://www.suagaragem.net", "?q=Citro%C3%ABn+2015&city=serra&maxPrice=80000&sort=menor-preco&page=3&utm_source=preview"));
  assert.equal(url.origin, "https://www.suagaragem.net");
  assert.equal(url.pathname, "/estoque");
  assert.equal(url.searchParams.get("q"), "Citroën 2015");
  assert.equal(url.searchParams.get("city"), "serra");
  assert.equal(url.searchParams.get("maxPrice"), "80000");
  assert.equal(url.searchParams.get("sort"), "menor-preco");
  assert.equal(url.searchParams.has("page"), false);
  assert.equal(url.searchParams.has("utm_source"), false);
});
test("cancelar a busca compartilhada não dá erro nem copia nada", async () => {
  let copies = 0;
  const result = await shareVehicleLink({ share: async () => { throw new DOMException("Cancelado", "AbortError"); }, clipboard: { writeText: async () => { copies++; } } }, { url: stockShareUrl("https://www.suagaragem.net", "?q=Civic") });
  assert.equal(result, "cancelled"); assert.equal(copies, 0);
});
test("sem compartilhamento nativo o link correto vai para a área de transferência", async () => {
  let copied = "";
  const url = stockShareUrl("https://www.suagaragem.net", "?brand=Honda&minYear=2015");
  assert.equal(await shareVehicleLink({ clipboard: { writeText: async text => { copied = text; } } }, { url }), "copied");
  assert.equal(copied, url);
});
