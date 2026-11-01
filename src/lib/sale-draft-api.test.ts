import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { beforeEach, test } from "node:test";

const updatedAt = new Date("2026-11-01T12:00:00Z");
const personal = { cpf: "11144477735", rg: "RG fictício", address: "Rua Fictícia", phone: "27999990000" };
let stored: { id: string; payload: unknown; updatedAt: Date } | null;
let saved: unknown;
let authenticated: boolean;
const tx = {
  $queryRaw: async () => [],
  adminDraft: {
    deleteMany: async () => {},
    findUnique: async () => stored,
    updateMany: async (args: unknown) => { saved = args; return { count: 1 }; },
    upsert: async (args: unknown) => { saved = args; return { updatedAt }; },
  },
};
const client = { ...tx, $transaction: async <T>(run: (value: typeof tx) => Promise<T>) => run(tx) };
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function (id, parent, isMain) {
  if (id === "@/lib/prisma") return { prisma: client };
  if (id === "@/lib/auth") return { getSession: async () => authenticated ? { adminId: "admin-ficticio" } : null };
  return original.call(this, id, parent, isMain);
};
let route: typeof import("../app/api/admin/drafts/route");
try { route = createRequire(import.meta.url)("../app/api/admin/drafts/route.ts"); }
finally { loader._load = original; }

beforeEach(() => { stored = null; saved = undefined; authenticated = true; });
const post = (body: unknown) => route.POST(new Request("http://localhost/api/admin/drafts", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(body),
}));

test("API não grava CPF, RG, endereço ou telefone enviados diretamente", async () => {
  const response = await post({ key: "sale:new:any", payload: { fields: { stage: 2, total: "100,00", customer: personal, ...personal }, ...personal }, photoUrls: [] });
  assert.equal(response.status, 200);
  assert.doesNotMatch(JSON.stringify(saved), /11144477735|RG fictício|Rua Fictícia|27999990000/);
  const write = saved as { create: { payload: { fields: { total: string } } }; update: { payload: unknown } };
  assert.equal(write.create.payload.fields.total, "100,00");
  assert.deepEqual(write.create.payload, write.update.payload);
});

test("GET retira dados pessoais legados da resposta e do rascunho, preservando a versão", async () => {
  stored = { id: "rascunho-ficticio", updatedAt, payload: { fields: { stage: 1, customer: personal }, ...personal } };
  const response = await route.GET(new Request("http://localhost/api/admin/drafts?key=sale:new:any"));
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /11144477735|RG fictício|Rua Fictícia|27999990000/);
  assert.doesNotMatch(JSON.stringify(saved), /11144477735|RG fictício|Rua Fictícia|27999990000/);
  const write = saved as { where: { updatedAt: Date }; data: { updatedAt: Date } };
  assert.equal(write.where.updatedAt, updatedAt);
  assert.equal(write.data.updatedAt, updatedAt);
});

test("reserva não mantém dados sensíveis de rascunho legado", async () => {
  stored = { id: "rascunho-ficticio", updatedAt, payload: { fields: { customer: personal } } };
  assert.equal((await post({ key: "sale:new:any", reserve: true, photoUrls: [] })).status, 200);
  assert.doesNotMatch(JSON.stringify(saved), /11144477735|RG fictício|Rua Fictícia|27999990000/);
});

test("API recusa payload inválido e sessão ausente antes de gravar", async () => {
  assert.equal((await post({ key: "sale:new:any", payload: null, photoUrls: [] })).status, 400);
  authenticated = false;
  assert.equal((await post({ key: "sale:new:any", payload: { fields: {} }, photoUrls: [] })).status, 401);
  assert.equal(saved, undefined);
});
