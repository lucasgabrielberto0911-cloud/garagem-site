import assert from "node:assert/strict";
import test from "node:test";
import { preparationPhotoError, preparationPrefill } from "./preparation";

const item = { brand: "Fiat", model: "Argo", color: "Branco", year: null, km: null, plate: "ABC1D23", purchasePrice: 40000 };

test("pré-preenchimento usa só dados reais: ano e km ausentes ficam em branco (não inventa 0/ano corrente)", () => {
  const p = preparationPrefill(item);
  assert.equal(p.year, undefined);
  assert.equal(p.km, undefined);
  assert.equal("fuel" in p, false);
  assert.equal("transmission" in p, false);
  assert.equal(p.purchasePrice, 40000);
  assert.equal(preparationPrefill({ ...item, year: 2020, km: 55000 }).km, 55000);
});

test("cadastro vindo de Em preparação exige foto antes de ir ao estoque", () => {
  assert.ok(preparationPhotoError(0));
  assert.equal(preparationPhotoError(3), null);
});
