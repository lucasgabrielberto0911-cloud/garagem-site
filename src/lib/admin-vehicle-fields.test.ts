import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVehicleFormFields, parseVehicleKm } from "./admin-vehicle-fields";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    year: " 2020 ", yearModel: "2021", km: "120.000 km", price: "R$ 45.900,00",
    status: "disponivel", plate: "abc-1234", doors: "", fipePrice: "", purchasePrice: "",
    ...overrides,
  })) data.set(key, value);
  return data;
}

test("cliente e servidor aceitam formatos humanos sem mudar a grandeza", () => {
  for (const price of ["45.900", "45900", " R$ 45.900,00 ", "45900.00"]) {
    for (const km of ["120.000 km", "120000", " 120 000 KM ", "120.000"]) {
      for (const plate of ["abc-1234", " ABC1D23 ", "abc 1234"]) {
        const server = parseVehicleFormFields(form({ price, km, plate }));
        const client = parseVehicleFormFields(form({ priceDisplay: price, kmDisplay: km, plate }));
        assert.deepEqual(client, server);
        assert.deepEqual(server.fieldErrors, {});
        assert.equal(server.price, 45900);
        assert.equal(server.km, 120000);
        assert.match(server.plate!, /^ABC/);
      }
    }
  }
});

test("centavos, opcionais vazios e zero não se confundem", () => {
  const parsed = parseVehicleFormFields(form({ price: "45900.50", plate: " ", km: "0" }));
  assert.equal(parsed.price, 45900.5);
  assert.equal(parsed.km, 0);
  for (const key of ["plate", "doors", "fipePrice", "purchasePrice"] as const)
    assert.equal(parsed[key], null);
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parseVehicleFormFields(form({ purchasePrice: "0", fipePrice: "45.900,50" })).purchasePrice, 0);
  assert.equal(parseVehicleFormFields(form({ purchasePrice: "inválido", consigned: "on" })).purchasePrice, null);
});

test("vazio obrigatório, frações, negativos e placa longa não viram números válidos", () => {
  for (const field of ["year", "yearModel", "km", "price"]) {
    for (const value of ["", " ", "-1", "texto"]) {
      assert.ok(parseVehicleFormFields(form({ [field]: value })).fieldErrors[field], `${field}: ${value}`);
    }
  }
  for (const km of ["120,5", "120.5", "-120000", "12.00", "120e3"])
    assert.ok(Number.isNaN(parseVehicleKm(km)), km);
  for (const plate of ["ABC12345", "AB1234", "ABC!1234", "1234567"])
    assert.match(parseVehicleFormFields(form({ plate })).fieldErrors.plate, /Placa:.*ABC-1234/);
  for (const field of ["doors", "fipePrice", "purchasePrice"])
    assert.ok(parseVehicleFormFields(form({ [field]: "inválido" })).fieldErrors[field]);
  assert.ok(parseVehicleFormFields(form({ year: "2020.5" })).fieldErrors.year);
  assert.ok(parseVehicleFormFields(form({ priceDisplay: "" })).fieldErrors.price);
  assert.ok(parseVehicleFormFields(form({ kmDisplay: "" })).fieldErrors.km);
});

test("corrigir entrada remove o erro na próxima validação", () => {
  const data = form({ year: "20", plate: "abc", km: "", price: "" });
  assert.deepEqual(Object.keys(parseVehicleFormFields(data).fieldErrors).sort(), ["km", "plate", "price", "year"]);
  data.set("year", "2020"); data.set("plate", "abc-1234");
  data.set("km", "120.000 km"); data.set("price", "45.900");
  assert.deepEqual(parseVehicleFormFields(data).fieldErrors, {});
});
