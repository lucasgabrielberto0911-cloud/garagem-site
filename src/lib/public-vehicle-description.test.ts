import test from "node:test";
import assert from "node:assert/strict";
import { publicVehicleDescription } from "./public-vehicle-description";
import { visibleDescriptionSegments } from "@/components/site/VehicleDescription";

test("vendido omite preço da legenda sem alterar os demais fatos", () => {
  const text = "Honda Civic\n💰 Valor: R$ 64.900\nAutomático\nPreço: 64900";
  assert.equal(publicVehicleDescription(text, true), "Honda Civic\nAutomático");
  assert.equal(publicVehicleDescription(text, false), text);
  assert.equal(publicVehicleDescription("R$ 64.900", true), null);
});

test("descrição pública nunca exibe placa ou final da placa", () => {
  const text = [
    "Honda Civic",
    "🔢 Final da placa: 7",
    "Final placa: 7",
    "Placa final 7",
    "Placa: ABC-1234",
    "Automático",
  ].join("\n");
  assert.equal(publicVehicleDescription(text, false), "Honda Civic\nAutomático");
  assert.equal(publicVehicleDescription(text, true), "Honda Civic\nAutomático");
  assert.equal(publicVehicleDescription("Final da placa: 7", false), null);

  const segments = visibleDescriptionSegments(text);
  const rendered = JSON.stringify(segments);
  assert.doesNotMatch(rendered, /placa|ABC-1234|\b7\b/i);
});
