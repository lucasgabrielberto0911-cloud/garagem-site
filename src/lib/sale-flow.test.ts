import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSaleFlowInput, resolveBuyer, resolveSignal } from "./sale-flow";

const base = {
  vehicleId: "v1", total: 50000, payments: [{ method: "pix", amount: 50000 }],
  customerId: "novo", customerName: " Maria ", customerPhone: "(27) 99999-1234",
};
const parse = (patch: Record<string, unknown> = {}) => parseSaleFlowInput(JSON.stringify({ ...base, ...patch }));
const message = (r: ReturnType<typeof parse>) => (r.ok ? "" : r.message);
const SUM = "A soma dos pagamentos deve ser igual ao valor negociado.";

test("JSON inválido ou não objeto", () => {
  assert.equal(message(parseSaleFlowInput("{")), "Dados da venda inválidos.");
  assert.equal(message(parseSaleFlowInput("[]")), "Dados da venda inválidos.");
  assert.equal(message(parseSaleFlowInput("null")), "Dados da venda inválidos.");
});

test("payload válido normaliza campos", () => {
  const r = parse({ seller: " Ana ", commission: 100 });
  assert.ok(r.ok);
  assert.equal(r.value.customerName, "Maria");
  assert.equal(r.value.customerPhone, "27999991234");
  assert.equal(r.value.sellerName, "Ana");
  assert.equal(r.value.commission, 100);
  assert.equal(r.value.total, 50000);
  assert.equal(r.value.cpf, "");
});

test("soma, total e veículo", () => {
  assert.equal(message(parse({ vehicleId: "" })), SUM);
  assert.equal(message(parse({ total: 0 })), SUM);
  assert.equal(message(parse({ total: "abc" })), SUM);
  assert.equal(message(parse({ total: 50000.123 })), SUM);
  assert.equal(message(parse({ payments: [] })), SUM);
  assert.equal(message(parse({ payments: [{ method: "pix", amount: 49000 }] })), SUM);
});

test("forma de pagamento repetida e incompleta", () => {
  assert.equal(message(parse({ payments: [{ method: "pix", amount: 25000 }, { method: "pix", amount: 25000 }] })), "Selecione cada forma de pagamento uma única vez.");
  assert.equal(message(parse({ payments: [{ method: "financiamento", amount: 50000 }] })), "Complete os campos da forma de pagamento selecionada.");
  assert.equal(message(parse({ payments: [{ method: "cartao", amount: 50000 }] })), "Complete os campos da forma de pagamento selecionada.");
  assert.equal(message(parse({ payments: [{ method: "troca", amount: 50000, tradeVehicle: "Gol" }] })), "Complete os campos da forma de pagamento selecionada.");
});

test("comprador, comissão, CPF e identificadores", () => {
  assert.equal(message(parse({ customerName: " " })), "Informe nome e telefone válidos do comprador.");
  assert.equal(message(parse({ customerPhone: "1234" })), "Informe nome e telefone válidos do comprador.");
  assert.equal(message(parse({ commission: -1 })), "Comissão inválida.");
  assert.equal(message(parse({ commission: "x" })), "Comissão inválida.");
  assert.equal(message(parse({ cpf: "111.111.111-11" })), "CPF inválido. Confira os 11 dígitos.");
  assert.ok(parse({ cpf: "529.982.247-25" }).ok);
  assert.equal(message(parse({ renavam: "12" })), "RENAVAM deve ter 11 dígitos.");
  assert.equal(message(parse({ chassis: "ABC" })), "Chassi deve ter 17 caracteres (letras e números).");
  assert.equal(message(parse({ rg: "x".repeat(21) })), "RG deve ter até 20 caracteres.");
});

test("comissão ausente vira null", () => {
  const r = parse();
  assert.ok(r.ok);
  assert.equal(r.value.commission, null);
});

const pix = [{ method: "pix" as const, amount: 50000 }];
const withSignal = [{ method: "pix" as const, amount: 40000 }, { method: "sinal" as const, amount: 10000 }];

test("sinal: sem sinal e sem reserva", () => {
  assert.equal(resolveSignal({ payments: pix, total: 50000, signalEnabled: false, reservation: null }), undefined);
});

test("sinal: informado nos pagamentos", () => {
  assert.deepEqual(resolveSignal({ payments: withSignal, total: 50000, signalEnabled: true, reservation: null }), { amount: 10000, reservationId: undefined });
});

test("sinal: reserva com depósito prevalece e exige coerência", () => {
  assert.deepEqual(resolveSignal({ payments: withSignal, total: 50000, signalEnabled: true, reservation: { id: "r1", deposit: 10000 } }), { amount: 10000, reservationId: "r1" });
  assert.throws(() => resolveSignal({ payments: withSignal, total: 50000, signalEnabled: true, reservation: { id: "r1", deposit: 5000 } }), /INVALID_SIGNAL/);
  assert.throws(() => resolveSignal({ payments: pix, total: 50000, signalEnabled: false, reservation: { id: "r1", deposit: 5000 } }), /RESERVATION_SIGNAL_REQUIRED/);
});

test("sinal: inválidos", () => {
  assert.throws(() => resolveSignal({ payments: [{ method: "pix", amount: 50000 }, { method: "sinal", amount: 0 }], total: 50000, signalEnabled: true, reservation: null }), /INVALID_SIGNAL/);
  assert.throws(() => resolveSignal({ payments: [{ method: "sinal", amount: 60000 }], total: 50000, signalEnabled: true, reservation: null }), /INVALID_SIGNAL/);
  assert.throws(() => resolveSignal({ payments: withSignal, total: 50000, signalEnabled: false, reservation: null }), /INVALID_SIGNAL/);
});

type Row = Record<string, unknown>;
function fakeTx(opts: { byId?: Row; byIdentity?: Row | null } = {}) {
  const calls: string[] = [];
  const tx = {
    $queryRaw: async () => { calls.push("lock"); return []; },
    customer: {
      findUnique: async ({ where }: { where: { id: string } }) => { calls.push(`find:${where.id}`); return opts.byId && opts.byId.id === where.id ? opts.byId : null; },
      findFirst: async () => { calls.push("dup"); return opts.byIdentity ?? null; },
      create: async ({ data }: { data: Row }) => { calls.push("create"); return { id: "novo-id", ...data }; },
      update: async ({ data, where }: { data: Row; where: { id: string } }) => { calls.push("update"); return { id: where.id, ...data }; },
    },
  };
  return { tx: tx as unknown as Parameters<typeof resolveBuyer>[0], calls };
}
const buyer = { customerId: "novo", customerName: "Maria", customerPhone: "27999991234", cpf: "", rg: "", address: " Rua A ", hasReservation: false };

test("resolveBuyer cria cliente novo", async () => {
  const { tx, calls } = fakeTx();
  const c = await resolveBuyer(tx, buyer);
  assert.equal(c.id, "novo-id");
  assert.equal(c.address, "Rua A");
  assert.equal(c.cpf, null);
  assert.deepEqual(calls, ["lock", "dup", "create"]);
});

test("resolveBuyer recusa duplicado", async () => {
  const { tx } = fakeTx({ byIdentity: { id: "x" } });
  await assert.rejects(resolveBuyer(tx, buyer), /DUPLICATE_CUSTOMER/);
});

test("resolveBuyer atualiza cliente existente e preserva cpf/rg antigos", async () => {
  const { tx, calls } = fakeTx({ byId: { id: "c1", cpf: "52998224725", rg: "123", address: "Antiga" } });
  const c = await resolveBuyer(tx, { ...buyer, customerId: "c1", address: undefined });
  assert.equal(c.id, "c1");
  assert.equal(c.cpf, "52998224725");
  assert.equal(c.rg, "123");
  assert.equal(c.address, "Antiga");
  assert.deepEqual(calls, ["find:c1", "lock", "lock", "dup", "update"]);
});

test("resolveBuyer: cliente inexistente", async () => {
  await assert.rejects(resolveBuyer(fakeTx().tx, { ...buyer, customerId: "zzz" }), /CUSTOMER_INVALID/);
});

test("resolveBuyer: reserva de outro comprador", async () => {
  const r = { ...buyer, hasReservation: true, reservationCustomerId: "c1" };
  await assert.rejects(resolveBuyer(fakeTx().tx, { ...r, customerId: "c2" }), /RESERVATION_CUSTOMER/);
  await assert.rejects(resolveBuyer(fakeTx().tx, { ...r, customerId: "" }), /RESERVATION_CUSTOMER/);
});

test("resolveBuyer: usa o cliente da reserva quando nada foi escolhido", async () => {
  const { tx } = fakeTx({ byId: { id: "c1", cpf: null, rg: null, address: null } });
  const c = await resolveBuyer(tx, { ...buyer, customerId: "", customerName: "", customerPhone: "", hasReservation: true, reservationCustomerId: "c1" });
  assert.equal(c.id, "c1");
});
