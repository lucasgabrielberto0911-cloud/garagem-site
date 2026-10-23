import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { parseAdminSellInput } from "./admin-sell";

test("Client gerencia soldAt após a migração 20261022180400", () => {
  const vehicle = Prisma.dmmf.datamodel.models.find(model => model.name === "Vehicle");
  assert.ok(vehicle);
  assert.equal(vehicle.fields.some(field => field.name === "soldAt" && field.type === "DateTime" && !field.isRequired), true);
});

test("payload vazio ou parcial marca venda simples", () => {
  assert.deepEqual(parseAdminSellInput({}), {
    ok: true,
    mode: "simple",
    input: {},
  });
  assert.deepEqual(parseAdminSellInput({ buyerName: "Ana" }), {
    ok: true,
    mode: "simple",
    input: { buyerName: "Ana" },
  });
});

test("payload completo normaliza telefone e valor", () => {
  assert.deepEqual(
    parseAdminSellInput({
      buyerName: " Ana Silva ",
      buyerPhone: "(27) 99999-1234",
      salePrice: 12345.678,
      paymentMethod: " Pix ",
      notes: " Entrega amanhã ",
    }),
    {
      ok: true,
      mode: "complete",
      input: {
        buyerName: "Ana Silva",
        buyerPhone: "27999991234",
        salePrice: 12345.68,
        paymentMethod: "Pix",
        notes: "Entrega amanhã",
      },
    },
  );
});

test("rejeita payload inválido e campos desconhecidos", () => {
  assert.equal(parseAdminSellInput([]).ok, false);
  assert.equal(parseAdminSellInput({ salePrice: -1 }).ok, false);
  assert.equal(parseAdminSellInput({ buyerPhone: "123" }).ok, false);
  assert.equal(parseAdminSellInput({ buyerName: "Ana", extra: true }).ok, false);
});
