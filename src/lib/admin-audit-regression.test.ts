import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";

type Nota = { id: string; number: number; issuanceKey: string; issuanceHash: string; installmentNo: number; installmentCount: number; amount: string; dueDate: Date; status: string; paidAt: Date | null; saleId: string | null };
let notes: Nota[];
let audits: Array<{ action: string; changes: Record<string, unknown> }>;
let writes: string[];
let reserved: boolean;
let documented: boolean;
let sold: boolean;
let overflow: boolean;
let authenticated: boolean;
let expected: Date;
const initialDate = new Date("2026-11-01T12:00:00Z");
let lead: { id: string; requestId?: string } | null;
let routeNotes: unknown[];
let routeQuery: Record<string, unknown>;

const models = {
  $executeRaw: async () => {}, $queryRaw: async () => [],
  vehicleReservation: { findFirst: async () => reserved ? { id: "reserva-ficticia" } : null },
  commercialDocument: { findFirst: async () => documented ? { id: "recibo-ficticio" } : null },
  sale: { findUnique: async () => sold ? { id: "venda-ficticia" } : null },
  vehicle: { delete: async () => { writes.push("delete"); return { id: "anuncio", photos: [], costs: [], documents: [] }; } },
  adminAudit: { create: async ({ data }: { data: (typeof audits)[number] }) => { audits.push(data); } },
  customer: {
    findUnique: async () => ({ id: "cliente-ficticio" }), findFirst: async () => null,
    create: async () => { writes.push("customer.create"); return { id: "cliente-ficticio" }; },
    updateMany: async ({ where }: { where: { updatedAt: Date } }) => {
      if (where.updatedAt.getTime() !== expected.getTime()) return { count: 0 };
      expected = new Date(expected.getTime() + 1); writes.push("customer.update"); return { count: 1 };
    },
  },
  promissoryNote: {
    findMany: async (args: { where: { issuanceKey?: string }; take?: number }) => {
      routeQuery = args;
      return args.where.issuanceKey ? notes.filter(note => note.issuanceKey === args.where.issuanceKey) : routeNotes;
    },
    create: async ({ data }: { data: Omit<Nota, "id" | "number" | "status" | "paidAt" | "saleId"> }) => {
      const note = { ...data, id: `nota-${notes.length + 1}`, number: notes.length + 1, status: "emitida", paidAt: null, saleId: null };
      writes.push("note.create"); notes.push(note); return note;
    },
    findUnique: async ({ where }: { where: { id: string } }) => { const note = notes.find(note => note.id === where.id); return note ? { ...note } : null; },
    updateMany: async ({ where, data }: { where: { id: string; status: string | { in: string[] } }; data: Partial<Nota> }) => {
      const note = notes.find(note => note.id === where.id);
      if (!note || (typeof where.status === "string" ? note.status !== where.status : !where.status.in.includes(note.status))) return { count: 0 };
      Object.assign(note, data); writes.push("note.update"); return { count: 1 };
    },
  },
  leadVenda: {
    findUnique: async () => lead,
    create: async ({ data }: { data: { requestId?: string } }) => { writes.push("lead.create"); lead = { id: "lead-ficticio", requestId: data.requestId }; return lead; },
  },
};
const client = { ...models, $transaction: async <T>(run: (tx: typeof models) => Promise<T>): Promise<T> => run(models) };
const require = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = loader._load;
loader._load = function (id, parent, isMain) {
  if (id === "@/lib/prisma") return { prisma: client };
  if (id === "@/lib/auth") return { getSession: async () => authenticated ? { adminId: "admin-ficticio" } : null };
  if (id === "next/navigation") return { redirect: () => { throw new Error("REDIRECT"); } };
  if (id === "next/cache") return { revalidatePath: () => {}, updateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  if (id === "@/lib/promissory-pdf") return { validatePromissoryPages: async () => { if (overflow) throw new Error("Os dados excedem o A4."); } };
  return originalLoad.call(this, id, parent, isMain);
};
let promissory: typeof import("../app/admin/promissorias/actions");
let customer: typeof import("../app/admin/clientes/actions");
let vehicle: typeof import("../app/admin/veiculos/actions");
let leads: typeof import("./lead-venda");
let pdfRoute: typeof import("../app/api/admin/promissorias/[id]/route");
try {
  promissory = require("../app/admin/promissorias/actions.ts");
  customer = require("../app/admin/clientes/actions.ts");
  vehicle = require("../app/admin/veiculos/actions.ts");
  leads = require("./lead-venda.ts");
  pdfRoute = require("../app/api/admin/promissorias/[id]/route.ts");
} finally { loader._load = originalLoad; }

beforeEach(() => {
  notes = []; audits = []; writes = []; lead = null; reserved = false; documented = false; sold = false; overflow = false; authenticated = true; expected = initialDate; routeNotes = []; routeQuery = {};
});
function form(values: Record<string, string | undefined>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value); return data; }
function issuance() {
  return form({ requestId: "a1234567-1234-4321-9876-123456789abc", name: "Emitente Fictício", cpf: "11144477735", birthDate: "1980-01-01", phone: "27999990000", address: "Rua Fictícia, 1", count: "2", amount: "100,01", firstDueDate: "2027-01-31", issuedAt: "2026-11-01" });
}

for (const kind of ["reserva", "recibo", "venda"]) test(`exclusão preserva ${kind}, sem apagar anúncio ou arquivos`, async () => {
  reserved = kind === "reserva"; documented = kind === "recibo"; sold = kind === "venda";
  const result = await vehicle.deleteVehicle("anuncio");
  assert.equal(result?.ok, false); assert.match(result?.message ?? "", /histórico/);
  assert.deepEqual(writes, []);
  assert.equal(audits[0].action, "vehicle.delete.blocked");
});
test("repetir emissão devolve os mesmos IDs e não cria outro lote", async () => {
  const first = await promissory.createPromissoryNotes(issuance());
  const replay = await promissory.createPromissoryNotes(issuance());
  assert.equal(first.ok, true); assert.deepEqual(replay.noteIds, first.noteIds);
  assert.equal(notes.length, 2); assert.equal(audits.length, 2);
});
test("chave repetida com dados alterados exige conferir o lote", async () => {
  await promissory.createPromissoryNotes(issuance());
  const changed = issuance(); changed.set("amount", "200,00");
  const result = await promissory.createPromissoryNotes(changed);
  assert.equal(result.ok, false); assert.match(result.message, /outros dados/); assert.equal(notes.length, 2);
});
test("A4 inválido é recusado antes de qualquer gravação", async () => {
  overflow = true;
  const result = await promissory.createPromissoryNotes(issuance());
  assert.equal(result.ok, false); assert.match(result.message, /A4/); assert.deepEqual(writes, []);
});
test("retificação preserva data da baixa original e motivo na auditoria", async () => {
  await promissory.createPromissoryNotes(issuance());
  assert.equal((await promissory.markPromissoryPaid(notes[0].id)).ok, true);
  const originalPaidAt = notes[0].paidAt!.toISOString();
  assert.equal((await promissory.reversePromissoryPayment(notes[0].id, "Recebimento lançado na nota errada")).ok, true);
  assert.equal(notes[0].status, "emitida"); assert.equal(notes[0].paidAt, null);
  assert.equal(audits.at(-1)?.changes.originalPaidAt, originalPaidAt);
  assert.equal(audits.filter(audit => audit.action === "promissory.paid").length, 1);
  assert.equal((await promissory.reversePromissoryPayment(notes[0].id, "Recebimento lançado na nota errada")).ok, false);
});
test("nota vinculada volta à venda e motivo curto é recusado sem alterar dados", async () => {
  await promissory.createPromissoryNotes(issuance()); notes[0].saleId = "venda"; notes[0].status = "vinculada";
  await promissory.markPromissoryPaid(notes[0].id);
  assert.equal((await promissory.reversePromissoryPayment(notes[0].id, "erro")).ok, false);
  assert.equal(notes[0].status, "paga");
  await promissory.reversePromissoryPayment(notes[0].id, "Recebimento lançado na nota errada");
  assert.equal(notes[0].status, "vinculada");
});
test("PDF por CPF recusa acima de 60 sem omitir notas", async () => {
  routeNotes = Array.from({ length: 61 }, (_, i) => ({ id: String(i) }));
  const response = await pdfRoute.GET(new Request("http://localhost/api/admin/promissorias/abertas?cpf=11144477735"), { params: Promise.resolve({ id: "abertas" }) });
  assert.equal(response.status, 400); assert.equal(routeQuery.take, 61); assert.match(await response.text(), /Selecione até 60/);
});
test("cliente criado e editado gera trilha sem copiar dados pessoais", async () => {
  const values = { name: "Cliente Fictício", phone: "27999990000", email: "cliente@local.test", address: "Rua Fictícia, 1" };
  assert.equal((await customer.saveCustomer(form(values))).ok, true);
  assert.equal((await customer.saveCustomer(form({ ...values, id: "cliente", expectedUpdatedAt: expected.toISOString() }))).ok, true);
  assert.deepEqual(audits.map(audit => audit.action), ["customer.create", "customer.update"]);
  assert.ok(!JSON.stringify(audits).includes(values.phone));
});
test("duas edições do cliente não sobrescrevem a primeira", async () => {
  const data = form({ id: "cliente", name: "Cliente Fictício", phone: "27999990000", expectedUpdatedAt: expected.toISOString() });
  assert.equal((await customer.saveCustomer(data)).ok, true);
  const result = await customer.saveCustomer(data);
  assert.equal(result.ok, false); assert.match(result.message, /outra sessão/); assert.equal(writes.length, 1);
});
for (const invalid of [{ email: "cliente@" }, { name: "W".repeat(121) }, { address: "W".repeat(241) }, { notes: "W".repeat(3001) }, { phone: "12345678901234567890" }]) test(`cliente recusa campo inválido: ${Object.keys(invalid)[0]}`, async () => {
  const result = await customer.saveCustomer(form({ name: "Cliente Fictício", phone: "27999990000", ...invalid }));
  assert.equal(result.ok, false); assert.deepEqual(writes, []);
});
test("reenvio de avaliação cria um único lead", async () => {
  const input = { requestId: "pedido-ficticio-12345", name: "Cliente Fictício", phone: "27999990000", vehicleInfo: "Veículo fictício", plate: "", km: null, notes: null, interestVehicleId: null, source: "vender", photoUrls: [] };
  const first = await leads.createLeadVenda(input); const second = await leads.createLeadVenda(input);
  assert.equal(first.id, second.id); assert.equal("replayed" in second && second.replayed, true); assert.deepEqual(writes, ["lead.create"]);
});
test("ações financeiras exigem sessão", async () => {
  authenticated = false;
  await assert.rejects(promissory.createPromissoryNotes(issuance()), /REDIRECT/);
  await assert.rejects(promissory.reversePromissoryPayment("nota", "Motivo fictício válido"), /REDIRECT/);
  assert.deepEqual(writes, []);
});
test("agregador do CI espera migrations e falha se elas não passam", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const check = workflow.split("  check:")[1].split("  migrations:")[0];
  assert.match(check, /needs: \[unit, e2e, migrations\]/);
  assert.match(check, /needs\.migrations\.result.*!= "success"/);
});
