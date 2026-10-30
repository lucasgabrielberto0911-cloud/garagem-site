import assert from "node:assert/strict";
import { test } from "node:test";
import { firstSaleProblem, SALE_STAGE, validateSaleStage } from "./sale-flow-validation";
import type { SaleDraft } from "./sale-flow-validation";

const ok: SaleDraft = {
  vehicleId: "v1",
  customer: { name: "Maria Teste", phone: "(27) 99999-1234", cpf: "" },
  total: 50000,
  payments: [{ method: "pix", amount: 50000 }],
  commission: "",
};
const stage = (n: number, patch: Partial<SaleDraft> = {}) => validateSaleStage(n, { ...ok, ...patch });

test("rascunho completo não tem problema em nenhuma etapa", () => {
  assert.equal(firstSaleProblem(ok), null);
});

test("veículo é obrigatório", () => {
  assert.match(stage(SALE_STAGE.vehicle, { vehicleId: "" }) ?? "", /veículo/i);
});

test("cliente: nome, telefone com DDD e CPF válido", () => {
  assert.match(stage(SALE_STAGE.customer, { customer: null }) ?? "", /cliente/i);
  assert.match(stage(SALE_STAGE.customer, { customer: { ...ok.customer!, name: " " } }) ?? "", /nome/i);
  assert.match(stage(SALE_STAGE.customer, { customer: { ...ok.customer!, phone: "123" } }) ?? "", /telefone/i);
  assert.match(stage(SALE_STAGE.customer, { customer: { ...ok.customer!, cpf: "111.111.111-11" } }) ?? "", /CPF/);
  assert.equal(stage(SALE_STAGE.customer, { customer: { ...ok.customer!, cpf: "529.982.247-25" } }), null);
});

test("pagamento: total, forma, campos da forma e soma com a diferença dita em reais", () => {
  assert.match(stage(SALE_STAGE.payment, { total: 0 }) ?? "", /total/i);
  assert.match(stage(SALE_STAGE.payment, { payments: [] }) ?? "", /forma de pagamento/i);
  assert.match(stage(SALE_STAGE.payment, { payments: [{ method: "cartao", amount: 50000 }] }) ?? "", /parcelas/);
  assert.match(stage(SALE_STAGE.payment, { payments: [{ method: "troca", amount: 50000, tradeVehicle: "Gol" }] }) ?? "", /placa/);
  assert.match(stage(SALE_STAGE.payment, { payments: [{ method: "pix", amount: 0 }] }) ?? "", /valor/i);
  assert.match(stage(SALE_STAGE.payment, { payments: [{ method: "pix", amount: 49000 }] }) ?? "", /Faltam .*1\.000,00/);
  assert.match(stage(SALE_STAGE.payment, { payments: [{ method: "pix", amount: 51000 }] }) ?? "", /passam .*1\.000,00/);
});

test("financiamento soma entrada adicional ao valor financiado", () => {
  assert.equal(stage(SALE_STAGE.payment, { payments: [{ method: "financiamento", amount: 40000, downPayment: 10000, installments: 48 }] }), null);
});

test("comissão vazia vale, inválida não", () => {
  assert.equal(stage(SALE_STAGE.seller, { commission: "1.500,00" }), null);
  assert.match(stage(SALE_STAGE.seller, { commission: "abc" }) ?? "", /Comissão/);
});

test("firstSaleProblem aponta a primeira etapa com erro", () => {
  const problem = firstSaleProblem({ ...ok, customer: { ...ok.customer!, phone: "1" }, total: 0 });
  assert.equal(problem?.stage, SALE_STAGE.customer);
});
