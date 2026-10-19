import assert from "node:assert/strict";
import { test } from "node:test";
import { stockLandingLinks, stockLandingSlug } from "./stock-landings";
test("landings deduplicam caixa e acentos sem misturar marcas", () => {
  const links = stockLandingLinks([{ brand: "Honda", model: "Civic" }, { brand: "HONDA", model: "CIVIC" }, { brand: "Toyota", model: "Civic" }, { brand: "", model: "" }]);
  assert.equal(links.length, 4);
  assert.ok(links.some(row => row.path === "/modelo/honda-civic"));
  assert.ok(links.some(row => row.path === "/modelo/toyota-civic"));
  assert.equal(stockLandingSlug("Citroën C4 Cactus"), "citroen-c4-cactus");
  assert.deepEqual(stockLandingLinks([]), []);
});
