import assert from "node:assert/strict";
import { test } from "node:test";
import { evenVehicleGridItems } from "./vehicle-grid-pairs";

test("evenVehicleGridItems mantém 0, 1 e quantidades pares", () => {
  assert.deepEqual(evenVehicleGridItems([]), []);
  assert.deepEqual(evenVehicleGridItems([1]), [1]);
  assert.deepEqual(evenVehicleGridItems([1, 2]), [1, 2]);
  assert.deepEqual(evenVehicleGridItems([1, 2, 3, 4, 5, 6, 7, 8]), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("evenVehicleGridItems corta o último item quando há 3 ou mais e a quantidade é ímpar", () => {
  assert.deepEqual(evenVehicleGridItems([1, 2, 3]), [1, 2]);
  assert.deepEqual(evenVehicleGridItems([1, 2, 3, 4, 5]), [1, 2, 3, 4]);
  assert.deepEqual(evenVehicleGridItems([1, 2, 3, 4, 5, 6, 7]), [1, 2, 3, 4, 5, 6]);
});
