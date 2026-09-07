import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cityShowcaseOffset,
  pickCityShowcase,
  rotateItems,
} from "./city-showcase";

test("cidades diferentes começam o recorte em pontos diferentes", () => {
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const serra = pickCityShowcase(items, "serra", 8);
  const vitoria = pickCityShowcase(items, "vitoria", 8);
  assert.equal(serra.length, 8);
  assert.equal(vitoria.length, 8);
  assert.notDeepEqual(serra, vitoria);
  assert.deepEqual(rotateItems([1, 2, 3], 1), [2, 3, 1]);
  assert.equal(cityShowcaseOffset("serra", 10) !== cityShowcaseOffset("vitoria", 10), true);
});
