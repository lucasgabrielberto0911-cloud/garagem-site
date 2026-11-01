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
let lead: { id: string; phone: string; name: string; source: string; notes: null; vehicleInfo: string; plate: null } | null;
let missingCustomerVersion: boolean;
let unexpectedColumn: boolean;
let customerQueries: Array<Record<string, unknown>>;
let writtenPhones: string[];
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
    findMany: async (query: { select: Record<string, unknown> }) => {
      customerQueries.push(query.select);
      if (unexpectedColumn) throw { code: "P2022", meta: { column: "Customer.email" } };
      if (missingCustomerVersion && query.select.updatedAt) throw { code: "P2022", meta: { column: "Customer.updatedAt" } };
      return [{ id: "cliente-ficticio", name: "Cliente Fictício", phone: "27999990000", cpf: null, email: null, address: null, notes: null, createdAt: initialDate, ...(query.select.updatedAt ? { updatedAt: initialDate } : {}) }];
    },
    create: async ({ data }: { data: { phone: string } }) => { if (missingCustomerVersion) throw { code: "P2022", meta: { column: "Customer.updatedAt" } }; writes.push("customer.create"); writtenPhones.push(data.phone); return { id: "cliente-ficticio" }; },
    updateMany: async ({ where }: { where: { updatedAt: Date } }) => {
      if (missingCustomerVersion) throw { code: "P2022", meta: { column: "Customer.updatedAt" } };
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
    create: async ({ data }: { data: { phone: string } }) => { writes.push("lead.create"); writtenPhones.push(data.phone); return { id: "lead-ficticio" }; },
  },
  leadActivity: { create: async () => {} },
};
const client = { ...models, $transaction: async <T>(run: (tx: typeof models) => Promise<T>): Promise<T> => run(models) };
const require = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = loader._load;
loader._load = function (id, parent, isMain) {
  if (id === "@/lib/prisma") return { prisma: client };
  if (id === "@/lib/auth") return { getSession: async () => authenticated ? { adminId: "admin-ficticio" } : null };
  if (id === "next/navigation") return { redirect: () => { throw new Error("REDIRECT"); } };
  if (id === "next/cache") return { revalidatePath: () => {}, updateTag: () => {}, revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  if (id === "@/lib/promissory-pdf") return { validatePromissoryPages: async () => { if (overflow) throw new Error("Os dados excedem o A4."); } };
  return originalLoad.call(this, id, parent, isMain);
};
let promissory: typeof import("../app/admin/promissorias/actions");
let customer: typeof import("../app/admin/clientes/actions");
let vehicle: typeof import("../app/admin/veiculos/actions");
let adminCustomers: typeof import("./admin-customers");
let leadActions: typeof import("../app/admin/leads/actions");
let pdfRoute: typeof import("../app/api/admin/promissorias/[id]/route");
try {
  promissory = require("../app/admin/promissorias/actions.ts");
  adminCustomers = require("./admin-customers.ts");
  leadActions = require("../app/admin/leads/actions.ts");
  customer = require("../app/admin/clientes/actions.ts");
  vehicle = require("../app/admin/veiculos/actions.ts");
  pdfRoute = require("../app/api/admin/promissorias/[id]/route.ts");
} finally { loader._load = originalLoad; }

beforeEach(() => {
  missingCustomerVersion = false; unexpectedColumn = false; customerQueries = []; writtenPhones = [];
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

test("clientes lista sem updatedAt durante implantação, com versão indisponível", async () => {
  missingCustomerVersion = true;
  const rows = await adminCustomers.listAdminCustomers({ where: {}, skip: 0, take: 40 });
  assert.equal(rows[0].updatedAt, null);
  assert.equal(rows[0].name, "Cliente Fictício");
  assert.equal(customerQueries.length, 2);
  assert.equal(customerQueries[1].updatedAt, undefined);
});
test("clientes não mascara coluna alheia ausente", async () => {
  unexpectedColumn = true;
  await assert.rejects(adminCustomers.listAdminCustomers({ where: {}, skip: 0, take: 40 }));
  assert.equal(customerQueries.length, 1);
});
test("clientes bloqueia gravações sem migration e mantém o cadastro intacto", async () => {
  missingCustomerVersion = true;
  for (const values of [{}, { id: "cliente", expectedUpdatedAt: initialDate.toISOString() }, { id: "cliente" }]) {
    const result = await customer.saveCustomer(form({ name: "Cliente Fictício", phone: "27999990000", ...values }));
    assert.equal(result.ok, false);
    assert.match(result.message, /atualização do banco/);
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(audits, []);
});
for (const phone of ["123456789", "123456789012", "12345678901234", "abc"]) test(`ações de leads recusam telefone inválido ${phone}`, async () => {
  lead = { id: "lead-ficticio", name: "Cliente Fictício", phone, source: "whatsapp:direto", notes: null, vehicleInfo: "Fictício", plate: null };
  assert.equal((await leadActions.convertLeadToCustomer(lead.id)).ok, false);
  assert.equal((await leadActions.savePurchaseLead(form({ name: "Cliente Fictício", phone, origin: "direto", status: "conversa" }))).ok, false);
  assert.deepEqual(writes, []);
});
for (const [phone, normalized] of [["(27) 3333-0000", "2733330000"], ["+55 (27) 99999-0000", "27999990000"]]) test(`ações usam o mesmo telefone normalizado: ${phone}`, async () => {
  lead = { id: "lead-ficticio", name: "Cliente Fictício", phone, source: "whatsapp:direto", notes: null, vehicleInfo: "Fictício", plate: null };
  assert.equal((await customer.saveCustomer(form({ name: lead.name, phone }))).ok, true);
  assert.equal((await leadActions.convertLeadToCustomer(lead.id)).ok, true);
  assert.equal((await leadActions.savePurchaseLead(form({ name: lead.name, phone, origin: "direto", status: "conversa" }))).ok, true);
  assert.deepEqual(writtenPhones, [normalized, normalized, normalized]);
});
test("426 não exige requestId de LeadVenda, nem nas consultas implícitas do client", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8").split("model LeadVenda {")[1].split("}")[0];
  assert.doesNotMatch(schema, /requestId/);
});
