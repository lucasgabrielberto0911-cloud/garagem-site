import test from "node:test";
import assert from "node:assert/strict";
import { salePromissorySnapshots, type SalePromissoryRow } from "./sale-promissories";
import { parseSaleFlowInput } from "./sale-flow";

const buyer = { id: "cliente-teste", cpf: "52998224725" };
const note: SalePromissoryRow = { id: "nota-teste", number: 10, amount: 100.01, dueDate: "2027-01-31", status: "emitida", saleId: null, customerId: buyer.id, issuerCpf: "529.982.247-25" };
const payment = { method: "promissoria" as const, amount: 100.01, noteIds: [note.id] };

test("promissórias: snapshot usa os valores persistidos e soma centavos", () => {
  assert.deepEqual(salePromissorySnapshots(payment, [note], buyer), [{ id: note.id, number: 10, amount: 100.01, dueDate: "2027-01-31" }]);
  const other = { ...note, id: "nota-2", amount: 0.02, number: 11 };
  assert.equal(salePromissorySnapshots({ ...payment, amount: 100.03, noteIds: [note.id, other.id] }, [other, note], buyer).length, 2);
  assert.equal(salePromissorySnapshots(payment, [{ ...note, customerId: null }], buyer).length, 1);
});

test("promissórias: recusa nota inexistente, duplicada, paga, cancelada e já vinculada", () => {
  assert.throws(() => salePromissorySnapshots(payment, [], buyer), /PROMISSORY_UNAVAILABLE/);
  assert.throws(() => salePromissorySnapshots({ ...payment, noteIds: [note.id, note.id] }, [note, note], buyer), /PROMISSORY_UNAVAILABLE/);
  for (const status of ["paga", "cancelada", "vinculada"]) assert.throws(() => salePromissorySnapshots(payment, [{ ...note, status }], buyer), /PROMISSORY_UNAVAILABLE/);
  assert.throws(() => salePromissorySnapshots(payment, [{ ...note, saleId: "outra-venda" }], buyer), /PROMISSORY_UNAVAILABLE/);
});

test("promissórias: valor de outra nota e emitente diferente são rejeitados", () => {
  assert.throws(() => salePromissorySnapshots({ ...payment, amount: 100 }, [note], buyer), /PROMISSORY_TOTAL/);
  assert.throws(() => salePromissorySnapshots(payment, [note], { ...buyer, cpf: "11144477735" }), /PROMISSORY_BUYER/);
  assert.throws(() => salePromissorySnapshots(payment, [{ ...note, customerId: "outro-cliente" }], buyer), /PROMISSORY_BUYER/);
  assert.throws(() => salePromissorySnapshots(payment, [note], { ...buyer, cpf: null }), /PROMISSORY_BUYER/);
});

test("promissórias: repetir venda aceita nota paga da própria venda e recusa outra", () => {
  assert.equal(salePromissorySnapshots(payment, [{ ...note, status: "paga", saleId: "venda" }], buyer, "venda").length, 1);
  assert.throws(() => salePromissorySnapshots(payment, [{ ...note, status: "vinculada", saleId: "outra" }], buyer, "venda"), /PROMISSORY_UNAVAILABLE/);
});

test("venda: não aceita promissória sem seleção ou valor com fração de centavo", () => {
  const sale = { vehicleId: "veiculo", customerId: buyer.id, customerName: "Cliente Fictício", customerPhone: "27999990000", total: 100.01, payments: [payment] };
  assert.equal(parseSaleFlowInput(JSON.stringify(sale)).ok, true);
  const mixed = { ...sale, payments: [{ method: "pix", amount: sale.total }, { ...payment, amount: -1 }] };
  assert.equal(parseSaleFlowInput(JSON.stringify(mixed)).ok, false);
  for (const invalid of [{ ...payment, noteIds: [] }, { ...payment, noteIds: [note.id, note.id] }, { ...payment, amount: 100.011 }]) {
    assert.equal(parseSaleFlowInput(JSON.stringify({ ...sale, payments: [invalid] })).ok, false);
  }
});
