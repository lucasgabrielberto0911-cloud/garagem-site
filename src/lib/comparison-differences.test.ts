import test from "node:test";
import assert from "node:assert/strict";
import { comparisonDifference, differentComparisonText } from "./comparison-differences";

test("diferenças usam cadastro e centavos, sem apresentar zero como preço publicado", () => {
  assert.match(comparisonDifference("price", 74900, 89900)!, /15\.000 a menos/);
  assert.match(comparisonDifference("price", 10.2, 10.1)!, /0,10 a mais/);
  assert.equal(comparisonDifference("price", 0, 89900), null);
  assert.equal(comparisonDifference("price", 74900, 74900), null);
});
test("quilometragem zero é válida; ano é modelo, não avaliação de estado", () => {
  assert.equal(comparisonDifference("km", 0, 10000), "10.000 km a menos");
  assert.equal(comparisonDifference("yearModel", 2016, 2015), "Modelo 1 ano mais recente");
  assert.equal(comparisonDifference("yearModel", 2015, 2017), "Modelo 2 anos mais antigo");
  for (const value of [NaN, Infinity, -1, 1.5]) assert.equal(comparisonDifference("km", value, 10000), null);
  assert.equal(differentComparisonText("Automático", " automático "), false);
  assert.equal(differentComparisonText("—", "Manual"), false);
});
