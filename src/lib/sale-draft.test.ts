import assert from "node:assert/strict";
import { test } from "node:test";
import { safeAdminDraftPayload, saleDraftFields } from "./sale-draft";

test("rascunho permite valores e etapas, sem copiar cliente, documentos ou texto livre", () => {
  const source = {
    stage: 3, total: "10.000,00", commission: "500,00", signal: true, includeProposal: true,
    customer: { cpf: "11144477735", rg: "RG fictício", address: "Rua Fictícia", phone: "27999990000" },
    ids: { rg: "RG fictício" }, phone: "27999990000", conditions: "Rua Fictícia",
    vehicle: { reservedCustomer: { phone: "27999990000" } },
    payments: [{ method: "financiamento", amount: 10000, installments: 12, bank: "Rua Fictícia", phone: "27999990000" }],
  };
  assert.deepEqual(saleDraftFields(source), {
    vehicleId: null, customerId: null,
    stage: 3, total: "10.000,00", commission: "500,00", signal: true, includeProposal: true,
    payments: [{ method: "financiamento", amount: 10000, installments: 12 }],
  });
  const stored = safeAdminDraftPayload("sale:new:any", { fields: source, cpf: "11144477735" });
  assert.deepEqual(stored, { fields: saleDraftFields(source) });
  assert.doesNotMatch(JSON.stringify(stored), /11144477735|RG fictício|Rua Fictícia|27999990000/);
});

test("rascunho conserva referências e resumo das notas sem copiar o emitente", () => {
  const result = saleDraftFields({ vehicleId: "veiculo-ficticio", customerId: "cliente-ficticio", payments: [{
    method: "promissoria", amount: 100, noteIds: ["nota-ficticia"],
    notes: [{ id: "nota-ficticia", number: 1, amount: 100, dueDate: "2027-01-31", issuer: { cpf: "11144477735" } }],
  }] });
  assert.equal(result.vehicleId, "veiculo-ficticio");
  assert.equal(result.customerId, "cliente-ficticio");
  assert.deepEqual(result.payments[0].noteIds, ["nota-ficticia"]);
  assert.deepEqual(result.payments[0].notes, [{ id: "nota-ficticia", number: 1, amount: 100, dueDate: "2027-01-31" }]);
  assert.doesNotMatch(JSON.stringify(result), /issuer|11144477735/);
});

test("rascunho legado ou malformado é filtrado também na leitura", () => {
  const safe = saleDraftFields({ stage: 99, total: { phone: "27999990000" }, commission: "Rua Fictícia", payments: [null, { method: "cpf", amount: 100 }, { method: "pix", amount: Infinity, installments: { cpf: "11144477735" } }] });
  assert.equal(safe.stage, 4);
  assert.equal(safe.total, "");
  assert.equal(safe.commission, "");
  assert.deepEqual(safe.payments, [{ method: "pix", amount: 0 }]);
  assert.deepEqual(safeAdminDraftPayload("sale:new:any", null), { fields: saleDraftFields(null) });
});

test("contrato dos rascunhos de veículos continua preservado", () => {
  const payload = { fields: { model: "Fictício" }, photos: [] };
  assert.deepEqual(safeAdminDraftPayload("vehicle:new", payload), payload);
});
