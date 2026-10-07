import test from "node:test";
import assert from "node:assert/strict";
import { unavailableFavoriteIds } from "./unavailable-favorites";
test("só uma consulta atual concluída permite separar os indisponíveis", () => {
  assert.deepEqual(unavailableFavoriteIds(["a", "b"], ["a"], false), []);
  assert.deepEqual(unavailableFavoriteIds(["a", "b", "b", "c"], ["a", "c"], true), ["b"]);
  assert.deepEqual(unavailableFavoriteIds(["a", "b"], [], true), ["a", "b"]);
});
test("ids fora do limite consultado não são classificados como indisponíveis", () => {
  const ids = Array.from({ length: 65 }, (_, n) => String(n));
  assert.deepEqual(unavailableFavoriteIds(ids, ids.slice(0, 59), true), ["59"]);
});
