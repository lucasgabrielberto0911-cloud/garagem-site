import assert from "node:assert/strict";
import test from "node:test";
import {
  VEHICLE_DRAFT_FIELDS,
  vehicleDraftFields,
  vehicleDraftHref,
  vehicleDraftParam,
  vehicleDraftSummary,
} from "./vehicle-draft-fields";

test("parâmetro de rascunho usa o primeiro valor e ignora valores inválidos", () => {
  assert.equal(vehicleDraftParam("a"), "a");
  assert.equal(vehicleDraftParam(["a", "b"]), "a");
  assert.equal(vehicleDraftParam([]), undefined);
  assert.equal(vehicleDraftParam([42, "b"]), undefined);
  assert.equal(vehicleDraftParam("  "), undefined);
  assert.equal(vehicleDraftParam(null), undefined);
});

test("captura e restauração usam o mesmo contrato sem compartilhar referências", () => {
  const source = Object.fromEntries(
    VEHICLE_DRAFT_FIELDS.map((key) => [key, { valor: key }]),
  );
  const snapshot = vehicleDraftFields({ ...source, intruso: "ignorar" });
  assert.deepEqual(Object.keys(snapshot), [...VEHICLE_DRAFT_FIELDS]);
  assert.deepEqual(vehicleDraftFields(snapshot), source);
  assert.notEqual(snapshot.photos, source.photos);
  assert.deepEqual(vehicleDraftFields({ brand: "Teste" }), { brand: "Teste" });
});

test("resumo não expõe placa, preço, fotos nem campos internos", () => {
  assert.deepEqual(
    vehicleDraftSummary({
      brand: "Marca",
      model: "Modelo",
      year: "2020",
      plate: "ABC1D23",
      fields: { preparationId: "p1" },
    }),
    {
      title: "Marca Modelo 2020",
      preparationId: "p1",
    },
  );
  assert.equal(vehicleDraftSummary(null).title, "Veículo sem identificação");
  assert.equal(
    vehicleDraftHref("vehicle:new", null),
    "/admin/veiculos/novo?draft=new",
  );
  assert.equal(
    vehicleDraftHref("vehicle:new-p1", "p1"),
    "/admin/veiculos/novo?draft=new-p1&prep=p1",
  );
});
