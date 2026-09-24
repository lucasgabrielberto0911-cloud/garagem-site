import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_VEHICLE_LOCATION_CITY,
  catalogAddressCity,
  catalogPlace,
  isVehicleLocationCity,
  parseVehicleLocationCity,
  resolveVehicleLocationCity,
  vehicleLocationLabel,
} from "./vehicle-location";

test("default de cadastro novo é Linhares, no padrão do schema", () => {
  assert.equal(DEFAULT_VEHICLE_LOCATION_CITY, "linhares");
  assert.equal(resolveVehicleLocationCity(null), "linhares");
  assert.equal(resolveVehicleLocationCity(""), "linhares");
  assert.equal(resolveVehicleLocationCity("vitória"), "linhares");
  assert.equal(catalogAddressCity(undefined), "Linhares");
});

test("parseia só Serra ou Linhares — não chuta pelo modelo nem por outra cidade", () => {
  assert.equal(parseVehicleLocationCity("serra"), "serra");
  assert.equal(parseVehicleLocationCity("Linhares"), "linhares");
  assert.equal(parseVehicleLocationCity("SERRA"), "serra");
  assert.equal(parseVehicleLocationCity("  linhares  "), "linhares");
  assert.equal(parseVehicleLocationCity("vitoria"), null);
  assert.equal(parseVehicleLocationCity("aracruz"), null);
  assert.equal(parseVehicleLocationCity("Civic EXL"), null);
  assert.equal(isVehicleLocationCity("serra"), true);
  assert.equal(isVehicleLocationCity("linhares"), true);
  assert.equal(isVehicleLocationCity("aracruz"), false);
});

test("rótulos em português e cidade do catálogo Meta", () => {
  assert.equal(vehicleLocationLabel("serra"), "Serra");
  assert.equal(vehicleLocationLabel("linhares"), "Linhares");
  assert.equal(vehicleLocationLabel("aracruz"), "");
  assert.equal(catalogAddressCity("serra"), "Serra");
  assert.equal(catalogAddressCity("linhares"), "Linhares");
  assert.equal(catalogPlace("serra").city, "Serra");
  assert.equal(catalogPlace("vitoria").city, "Linhares");
  assert.notEqual(catalogPlace(undefined).city, "Vitória");
});
