import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { loadLeadActivity } from "./lead-activity";
import { prisma } from "./prisma";
import { mockPrismaMethod } from "./test-mock";

const lead = {
  id: "lead-atual", name: "Cliente", phone: "27999999999", vehicleInfo: "Modelo",
  status: "novo", source: "site", nextAction: null, nextActionAt: null,
  createdAt: new Date("2026-10-20T12:00:00Z"), lostReason: null,
};
const activity = { id: "contato", note: "Contato registrado", createdAt: lead.createdAt };
const customer = { id: "cliente", name: "Cliente", createdAt: lead.createdAt, sales: [] };
const previous = { ...lead, id: "lead-anterior", activities: [] };

function setup(t: TestContext) {
  mockPrismaMethod(t, prisma.leadVenda, "findUnique", async () => lead);
  mockPrismaMethod(t, prisma.leadActivity, "findMany", async () => [activity]);
  mockPrismaMethod(t, prisma.leadVenda, "findMany", async () => [previous]);
  mockPrismaMethod(t, prisma.customer, "findFirst", async () => customer);
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  return logs;
}

test("timeline completa sinaliza partial=false", async (t) => {
  const logs = setup(t);
  const result = await loadLeadActivity(lead.id);
  assert.equal(result.partial, false);
  assert.deepEqual(result.activities, [activity]);
  assert.ok(result.timeline.some(item => item.kind === "anterior"));
  assert.ok(result.timeline.some(item => item.kind === "cliente"));
  assert.equal(logs.length, 0);
});

for (const source of ["leads", "cliente", "ambos"]) {
  test(`timeline sinaliza e registra falha de ${source}, preservando histórico disponível`, async (t) => {
    const logs = setup(t);
    if (source !== "cliente") mockPrismaMethod(t, prisma.leadVenda, "findMany", async () => { throw new Error("dados privados"); });
    if (source !== "leads") mockPrismaMethod(t, prisma.customer, "findFirst", async () => { throw new Error("dados privados"); });
    const result = await loadLeadActivity(lead.id);
    assert.equal(result.partial, true);
    assert.deepEqual(result.activities, [activity]);
    assert.ok(result.timeline.some(item => item.kind === "contato"));
    assert.equal(result.timeline.some(item => item.kind === "anterior"), source === "cliente");
    assert.equal(result.timeline.some(item => item.kind === "cliente"), source === "leads");
    assert.equal(logs.length, source === "ambos" ? 2 : 1);
    assert.match(JSON.stringify(logs), /parcial/);
    assert.doesNotMatch(JSON.stringify(logs), /dados privados|27999999999/);
  });
}

test("ausência de histórico e telefone curto não geram falso aviso parcial", async (t) => {
  const logs = setup(t);
  mockPrismaMethod(t, prisma.leadVenda, "findMany", async () => []);
  mockPrismaMethod(t, prisma.customer, "findFirst", async () => null);
  assert.equal((await loadLeadActivity(lead.id)).partial, false);
  mockPrismaMethod(t, prisma.leadVenda, "findUnique", async () => ({ ...lead, phone: "" }));
  assert.equal((await loadLeadActivity(lead.id)).partial, false);
  assert.equal(logs.length, 0);
});

test("falha nas consultas essenciais não vira timeline parcial com sucesso", async (t) => {
  setup(t);
  mockPrismaMethod(t, prisma.leadActivity, "findMany", async () => { throw new Error("consulta essencial falhou"); });
  await assert.rejects(loadLeadActivity(lead.id), /consulta essencial falhou/);
});


test("timeline preserva compatibilidade com coluna lostReason ausente", async (t) => {
  setup(t);
  let calls = 0;
  mockPrismaMethod(t, prisma.leadVenda, "findUnique", async () => {
    if (++calls === 1) throw { code: "P2022" };
    return lead;
  });
  assert.equal((await loadLeadActivity(lead.id)).partial, false);
  assert.equal(calls, 2);
});

test("lead ausente mantém atividades e timeline vazia", async (t) => {
  setup(t);
  mockPrismaMethod(t, prisma.leadVenda, "findUnique", async () => null);
  assert.deepEqual(await loadLeadActivity(lead.id), { activities: [activity], timeline: [], partial: false });
});
