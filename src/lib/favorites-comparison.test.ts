import assert from "node:assert/strict";
import { test } from "node:test";
import { comparisonSelection, toggleComparison } from "./favorites-comparison";

test("começa com dois e permite escolher outros favoritos sem alterar a lista", () => {
  const favorites = ["a", "b", "c", "d"];
  assert.deepEqual(comparisonSelection(favorites, null), ["a", "b"]);
  const selection = toggleComparison(toggleComparison(["a", "b"], "a"), "d");
  assert.deepEqual(comparisonSelection(favorites, selection), ["b", "d"]);
  assert.deepEqual(favorites, ["a", "b", "c", "d"]);
});
test("não duplica, limita três e retira anúncios indisponíveis da comparação", () => {
  assert.deepEqual(toggleComparison(["a", "b", "c"], "d"), ["a", "b", "c"]);
  assert.deepEqual(comparisonSelection(["a", "c"], ["a", "a", "b", "c"]), ["a", "c"]);
  assert.deepEqual(comparisonSelection(["a", "b"], []), []);
});
