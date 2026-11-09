import assert from "node:assert/strict";
import { test } from "node:test";
import { customerStockCategory, orderCustomerStock } from "./stock-customer-order";

test("estoque prioriza disponibilidade, galeria completa e recência sem alterar a entrada", () => {
  const vehicle = (id: string, photoCount: number, createdAt: string, status = "disponivel") => ({
    id, photoCount, createdAt, status, photos: [{ url: `${id}.webp` }],
  });
  const input = [
    vehicle("vendido", 8, "2026-11-09", "vendido"),
    vehicle("incompleto", 4, "2026-11-09"),
    vehicle("completo-antigo", 5, "2026-10-01"),
    vehicle("reservado", 9, "2026-11-09", "reservado"),
    vehicle("completo-recente", 5, "2026-11-08"),
    { ...vehicle("sem-capa", 5, "2026-11-09"), photos: [] },
  ];
  const ids = input.map(v => v.id);
  assert.deepEqual(orderCustomerStock(input).map(v => v.id), [
    "completo-recente", "completo-antigo", "incompleto", "sem-capa", "reservado", "vendido",
  ]);
  assert.deepEqual(input.map(v => v.id), ids);
});

test("carros por padrão; motos somente quando pedidas", () => {
  assert.equal(customerStockCategory({}), "carro");
  assert.equal(customerStockCategory({ category: "invalido" }), "carro");
  assert.equal(customerStockCategory({ category: "moto" }), "moto");
  assert.equal(customerStockCategory({ q: "quero uma moto Honda" }), "moto");
  assert.equal(customerStockCategory({ category: "carro", q: "moto" }), "carro");
});
