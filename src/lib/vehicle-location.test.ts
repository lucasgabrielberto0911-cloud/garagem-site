import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_VEHICLE_LOCATION_CITY,
  VEHICLE_LOCATION_CITIES,
  catalogAddressCity,
  catalogPlace,
  isVehicleLocationCity,
  parseVehicleLocationCity,
  publicCityStockLink,
  resolveVehicleLocationCity,
  vehicleLocationLabel,
} from "./vehicle-location";

test("cadastros antigos conservam Linhares como fallback", () => {
  assert.equal(DEFAULT_VEHICLE_LOCATION_CITY, "linhares");
  for (const value of [null, undefined, "", "Guarapari"]) {
    assert.equal(resolveVehicleLocationCity(value), "linhares");
    assert.equal(catalogAddressCity(value), "Linhares");
  }
});

test("as quatro cidades aceitam espaços, caixa e acento, sem inferir pelo modelo", () => {
  assert.equal(VEHICLE_LOCATION_CITIES.length, 4);
  for (const { value, label } of VEHICLE_LOCATION_CITIES) {
    assert.equal(isVehicleLocationCity(value), true);
    assert.equal(parseVehicleLocationCity(value), value);
    assert.equal(parseVehicleLocationCity(`  ${label.toUpperCase()}  `), value);
    assert.equal(resolveVehicleLocationCity(label), value);
    assert.equal(vehicleLocationLabel(value), label);
  }
  assert.equal(parseVehicleLocationCity("Vitoria"), "vitoria");
  for (const value of ["Guarapari", "Civic EXL", "", null, {}, 1]) {
    assert.equal(parseVehicleLocationCity(value), null);
    assert.equal(isVehicleLocationCity(value), false);
    assert.equal(vehicleLocationLabel(value), "");
  }
  assert.equal(isVehicleLocationCity("Vitória"), false);
});

test("links filtram as quatro cidades físicas, sem confundir região atendida", () => {
  for (const { value, label } of VEHICLE_LOCATION_CITIES) {
    assert.deepEqual(publicCityStockLink(value), {
      href: `/estoque?city=${value}`,
      label: `Ver os que estão em ${label}`,
      place: label,
    });
  }
  assert.equal(publicCityStockLink("vila-velha").href, "/estoque");
  assert.equal(publicCityStockLink("guarapari").place, "");
});

test("catálogo mantém a cidade salva, inclusive Vitória e Aracruz", () => {
  for (const { value, label } of VEHICLE_LOCATION_CITIES) {
    assert.equal(catalogAddressCity(value), label);
    assert.equal(catalogPlace(value).city, label);
    assert.match(catalogPlace(value).postalCode, /^\d{5}-\d{3}$/);
    assert.ok(catalogPlace(value).latitude < -19);
    assert.ok(catalogPlace(value).longitude < -40);
  }
  assert.equal(catalogPlace("linhares").postalCode, "29900-000");
  assert.equal(catalogPlace("serra").postalCode, "29160-000");
});
