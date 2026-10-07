import assert from "node:assert/strict";
import { test } from "node:test";
import { comparisonSelection, toggleComparison, parseComparisonSession } from "./favorites-comparison";

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

test("comparação mantém só ids válidos, seleção vazia e abertura da seção", () => {
  const a = "c" + "1".repeat(24), b = "c" + "2".repeat(24);
  assert.deepEqual(parseComparisonSession(JSON.stringify({ chosen: [a, a, b], open: true, price: 999 })), { chosen: [a, b], open: true });
  assert.deepEqual(parseComparisonSession('{"chosen":[],"open":true}'), { chosen: [], open: true });
  for (const raw of ['{oops', '{"chosen":["bad"],"open":true}', '{"chosen":[],"open":"yes"}']) assert.deepEqual(parseComparisonSession(raw), { chosen: null, open: false });
});
test("voltar à comparação filtra removidos e não altera a seleção guardada", () => {
  const chosen = ["b", "c"];
  assert.deepEqual(comparisonSelection(["a", "b"], chosen), ["b"]);
  assert.deepEqual(chosen, ["b", "c"]);
});
