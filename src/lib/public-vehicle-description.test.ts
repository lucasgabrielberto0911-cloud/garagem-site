import test from "node:test";
import assert from "node:assert/strict";
import { publicVehicleDescription } from "./public-vehicle-description";
test("vendido omite preço da legenda sem alterar os demais fatos", () => {
  const text = "Honda Civic\n💰 Valor: R$ 64.900\nAutomático\nPreço: 64900";
  assert.equal(publicVehicleDescription(text, true), "Honda Civic\nAutomático");
  assert.equal(publicVehicleDescription(text, false), text);
  assert.equal(publicVehicleDescription("R$ 64.900", true), null);
});
