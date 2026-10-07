import assert from "node:assert/strict";
import { test } from "node:test";
import { stockRangeError } from "./stock-range-validation";
const empty = { minPrice: "", maxPrice: "", minYear: "", maxYear: "" };
test("intervalos abertos e limites iguais são permitidos", () => {
  for (const values of [empty, { ...empty, minPrice: "50000" }, { ...empty, maxPrice: "30000" }, { ...empty, minPrice: "50000", maxPrice: "50000", minYear: "2020", maxYear: "2020" }]) assert.equal(stockRangeError(values), null);
});
test("intervalo de preço ou ano invertido explica o que ajustar", () => {
  assert.match(stockRangeError({ ...empty, minPrice: "50000", maxPrice: "30000" })!, /preço mínimo/);
  assert.match(stockRangeError({ ...empty, minYear: "2024", maxYear: "2020" })!, /ano mínimo/);
});
