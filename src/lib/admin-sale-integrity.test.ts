import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { beforeEach, test } from "node:test";

const vehicleId = "cadminintegridade000000001";
const date = new Date("2026-10-22T12:00:00Z");
const vehicle = (id = vehicleId) => ({
  id, brand: "Honda", model: "Civic", version: null, category: "carro",
  year: 2020, yearModel: 2020, km: 10000, price: 50000,
  fuel: "Flex", transmission: "Manual", color: "Preto", locationCity: "linhares",
  status: "vendido", historical: false, featured: false, soldAt: date,
  updatedAt: date, createdAt: date, description: "Veículo de teste", accessories: [],
  chassis: null, renavam: null, costs: [],
});
type Sale = { id: string; vehicleId: string; salePrice: number; customerId: string | null };
type Reservation = { id: string; deposit: number; status: string; customerId: string; customer: { name: string; phone: string } };
let state: ReturnType<typeof fixture>;

function fixture() {
  const data = {
    vehicles: [vehicle()], sales: [] as Sale[], reservation: null as Reservation | null,
    calls: [] as string[], writes: [] as { model: string; args: unknown }[], cache: [] as unknown[],
    onLock: () => {},
    customer: { id: "cliente", name: "Cliente de teste", phone: "27999991234", chassis: null, renavam: null, rg: null },
  };
  const write = (model: string, result: unknown = { count: 1 }) => async (args: unknown) => {
    data.writes.push({ model, args });
    return result;
  };
  const getVehicle = ({ where }: { where: { id: string } }) => ({
    ...data.vehicles.find(row => row.id === where.id),
    sale: data.sales.find(sale => sale.vehicleId === where.id) ?? null,
  });
  const client = {
    $queryRaw: async (parts: TemplateStringsArray) => {
      if (parts.join("").includes("FOR UPDATE")) { data.calls.push("lock"); data.onLock(); }
      return [];
    },
    vehicle: {
      findUnique: async (args: Parameters<typeof getVehicle>[0]) => getVehicle(args),
      findUniqueOrThrow: async (args: Parameters<typeof getVehicle>[0]) => getVehicle(args),
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => data.vehicles.filter(row => where.id.in.includes(row.id)),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        data.writes.push({ model: "vehicle", args });
        return { ...getVehicle(args), ...args.data, updatedAt: date };
      },
      updateMany: write("vehicle"),
    },
    sale: {
      findUnique: async ({ where }: { where: { vehicleId: string } }) => {
        data.calls.push("sale");
        return data.sales.find(row => row.vehicleId === where.vehicleId) ?? null;
      },
      findFirst: async ({ where }: { where: { vehicleId: { in: string[] } } }) => {
        data.calls.push("sale");
        return data.sales.find(row => where.vehicleId.in.includes(row.vehicleId)) ?? null;
      },
    },
    vehicleReservation: {
      findFirst: async () => { data.calls.push("reservation"); return data.reservation; },
      updateMany: write("reservation"),
    },
    customer: { findUnique: async () => data.customer },
    photo: { findMany: async () => [] },
    vehiclePriceHistory: { count: async () => 1 },
    adminAudit: { create: write("audit") },
    commercialDocument: {
      findFirst: async () => null,
      create: write("document", { id: "documento", number: 1 }),
    },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(client),
  };
  return Object.assign(data, { client });
}

// Os módulos reais rodam com sessão/cache simulados e banco em memória, sem integrações.
const require = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = loader._load;
const database = new Proxy({}, { get: (_target, key) => state.client[key as keyof typeof state.client] });
loader._load = function (id, parent, isMain) {
  if (id === "@/lib/auth") return { getSession: async () => ({ adminId: "admin", email: "teste@local.test" }) };
  if (id === "@/lib/prisma") return { prisma: database };
  if (id === "@/lib/listing-score-store") return { scoreListingAfterSave: async () => {} };
  if (id === "next/cache") return {
    revalidatePath: (...args: unknown[]) => state.cache.push(args),
    revalidateTag: (...args: unknown[]) => state.cache.push(args),
    updateTag: (...args: unknown[]) => state.cache.push(args),
    unstable_cache: (fn: unknown) => fn,
  };
  return originalLoad.call(this, id, parent, isMain);
};
let actions: typeof import("../app/admin/veiculos/actions");
let commercial: typeof import("../app/admin/veiculos/commercial-actions");
let sell: typeof import("../app/api/admin/vehicles/[id]/sell/route");
try {
  actions = require("../app/admin/veiculos/actions.ts");
  commercial = require("../app/admin/veiculos/commercial-actions.ts");
  sell = require("../app/api/admin/vehicles/[id]/sell/route.ts");
} finally { loader._load = originalLoad; }

beforeEach(t => { state = fixture(); t.mock.method(console, "error", () => {}); });
function addSale(amount = 50000) { state.sales.push({ id: "venda", vehicleId, customerId: "cliente", salePrice: amount }); }
function form(values: Record<string, unknown>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, String(value));
  return result;
}
function editForm() {
  return form({ ...vehicle(), status: "disponivel", photoUrls: "[]", expectedUpdatedAt: date.toISOString() });
}
function documentForm(amount = "50.000,00", kind = "contrato") {
  return form({ operation: "document", customerId: "cliente", kind, amount, payment: "Pix" });
}
function untouched() { assert.equal(state.writes.length, 0); assert.equal(state.cache.length, 0); }
function underLock(operation: string) {
  assert.ok(state.calls.indexOf("lock") >= 0);
  assert.ok(state.calls.indexOf(operation) > state.calls.indexOf("lock"));
}

test("status individual rejeita venda ativa antes de alterar reserva ou cache", async () => {
  addSale();
  const result = await actions.setVehicleStatus(vehicleId, "disponivel");
  assert.equal(result.ok, false); assert.match(result.message, /cancele.*venda/i);
  underLock("sale"); untouched();
});
test("venda criada enquanto o status aguarda a trava também bloqueia a volta", async () => {
  state.onLock = () => { if (!state.sales.length) addSale(); };
  assert.equal((await actions.setVehicleStatus(vehicleId, "disponivel")).ok, false);
  untouched();
});
test("lote com venda ativa rejeita tudo sem modificar o veículo sem venda", async () => {
  state.vehicles.push(vehicle("cadminintegridade000000002")); addSale();
  const result = await actions.setVehiclesStatus(state.vehicles.map(row => row.id), "disponivel");
  assert.equal(result.ok, false); assert.match(result.message, /cancele.*venda/i);
  assert.equal(state.calls.filter(call => call === "lock").length, 2);
  assert.equal(state.calls.filter(call => call === "sale").length, 1); untouched();
});
test("formulário completo não reabre veículo com venda", async () => {
  addSale();
  const result = await actions.updateVehicle(vehicleId, {}, editForm());
  assert.match(result.error ?? "", /cancele.*venda/i); underLock("sale"); untouched();
});
for (const mode of ["individual", "lote", "formulário"] as const) {
  test(`${mode} permite desfazer marcação simples sem Sale`, async () => {
    const result = mode === "individual" ? await actions.setVehicleStatus(vehicleId, "disponivel")
      : mode === "lote" ? await actions.setVehiclesStatus([vehicleId], "disponivel")
      : await actions.updateVehicle(vehicleId, {}, editForm());
    assert.ok("ok" in result ? result.ok : result.success, JSON.stringify(result));
    assert.ok(state.writes.some(write => write.model === "vehicle")); assert.ok(state.cache.length > 0);
  });
}
for (const amount of ["40.000,00", "50.000,01", "49.999,99"]) {
  test(`contrato de ${amount} diverge da venda de 50 mil e não gera documento`, async () => {
    addSale();
    const result = await commercial.saveCommercial(vehicleId, documentForm(amount));
    assert.equal(result.ok, false); assert.match(result.message, /valor.*venda|venda.*valor/i); untouched();
  });
}
test("contrato usa total da venda mesmo se o status legado estiver disponível", async () => {
  addSale(); state.vehicles[0].status = "disponivel";
  assert.equal((await commercial.saveCommercial(vehicleId, documentForm("40.000,00"))).ok, false);
  untouched();
});
test("contrato igual à venda, inclusive centavos, gera snapshot correto", async () => {
  addSale(50000.01);
  const result = await commercial.saveCommercial(vehicleId, documentForm("50.000,01"));
  assert.equal(result.ok, true, result.message);
  const written = state.writes.find(write => write.model === "document")!.args as { data: { snapshot: { total: number; amount: number; saleId: string } } };
  assert.equal(written.data.snapshot.total, 50000.01); assert.equal(written.data.snapshot.amount, 50000.01);
  assert.equal(written.data.snapshot.saleId, "venda");
});
test("proposta anterior à venda mantém valor negociado diferente do anúncio", async () => {
  state.vehicles[0].status = "disponivel";
  assert.equal((await commercial.saveCommercial(vehicleId, documentForm("40.000,00", "proposta"))).ok, true);
});
test("recibo parcial ligado à venda não exige valor integral", async () => {
  addSale();
  assert.equal((await commercial.saveCommercial(vehicleId, documentForm("1.000,00", "recibo"))).ok, true);
});

async function patch(body: unknown = {}) {
  return sell.PATCH(new Request("http://localhost/api/admin/vehicles/teste/sell", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: vehicleId }) });
}
for (const status of ["ativa", "convertida"]) {
  test(`venda simples com sinal na reserva ${status} retorna 409 sem gravar`, async () => {
    state.vehicles[0].status = "reservado";
    state.reservation = { id: "reserva", deposit: 1000, status, customerId: "cliente", customer: state.customer };
    const response = await patch();
    assert.equal(response.status, 409); assert.match((await response.json()).message, /sinal/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    underLock("reservation"); untouched();
  });
}
for (const deposit of [null, 0]) {
  test(`venda simples com ${deposit === null ? "nenhuma reserva" : "reserva sem sinal"} continua permitida`, async () => {
    state.vehicles[0].status = deposit === null ? "disponivel" : "reservado";
    if (deposit !== null) state.reservation = { id: "reserva", deposit, status: "ativa", customerId: "cliente", customer: state.customer };
    assert.equal((await patch()).status, 200);
    assert.ok(state.writes.some(write => write.model === "vehicle")); assert.ok(state.cache.length > 0);
  });
}
test("venda completa mantém bloqueio de sinal já existente", async () => {
  state.vehicles[0].status = "reservado";
  state.reservation = { id: "reserva", deposit: 1000, status: "ativa", customerId: "cliente", customer: state.customer };
  assert.equal((await patch({ buyerName: "Cliente de teste", buyerPhone: "27999991234", salePrice: 50000, paymentMethod: "Pix" })).status, 409);
  untouched();
});
