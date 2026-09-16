import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pickRelatedVehicles,
  priceBandHref,
  priceBandRange,
  relatedVehicleScore,
} from "./related-vehicles";

test("faixa de preço usa ±20% com piso de 8 mil", () => {
  assert.deepEqual(priceBandRange(89900), { min: 71920, max: 107880 });
  assert.deepEqual(priceBandRange(25000), { min: 17000, max: 33000 });
  assert.deepEqual(priceBandRange(0), { min: 0, max: 0 });
  assert.equal(priceBandHref(89900), "/estoque?minPrice=71920&maxPrice=107880");
  assert.equal(priceBandHref(0), "/estoque");
});

test("mesma faixa pontua mais que marca distante no preço", () => {
  const current = { brand: "Fiat", category: "carro", price: 89900 };
  const sameBand = relatedVehicleScore(
    {
      id: "pulse",
      brand: "Hyundai",
      category: "carro",
      price: 92900,
    },
    current,
  );
  const sameBrandFar = relatedVehicleScore(
    {
      id: "toro",
      brand: "Fiat",
      category: "carro",
      price: 189000,
    },
    current,
  );
  assert.ok(sameBand > sameBrandFar);
});

test("escolhe disponíveis próximos e exclui o carro da ficha", () => {
  const picked = pickRelatedVehicles(
    [
      { id: "self", brand: "Fiat", category: "carro", price: 89900 },
      { id: "near", brand: "Hyundai", category: "carro", price: 84900 },
      { id: "mid", brand: "VW", category: "carro", price: 99000 },
      { id: "far", brand: "Fiat", category: "carro", price: 210000 },
      { id: "moto", brand: "Honda", category: "moto", price: 88000 },
    ],
    { id: "self", brand: "Fiat", category: "carro", price: 89900 },
    3,
  );
  assert.deepEqual(
    picked.map((item) => item.id),
    ["near", "mid", "moto"],
  );
});
