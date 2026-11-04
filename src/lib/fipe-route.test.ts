import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { beforeEach, test } from "node:test";

let authenticated = true;
let stockFailure = false;
let aggregateArgs: unknown;
let calls = 0;
const require = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
loader._load = function (id, parent, isMain) {
  if (id === "@/lib/auth") return { getSession: async () => authenticated ? { adminId: "admin" } : null };
  if (id === "next/cache") return { unstable_cache: (fn: unknown, _keys: unknown, options: { revalidate: number; tags: string[] }) => { assert.equal(options.revalidate, 60); assert.ok(options.tags.includes("admin-data")); return fn; } };
  if (id === "@/lib/prisma") return { prisma: { vehicle: { aggregate: async (args: unknown) => { aggregateArgs = args; if (stockFailure) throw new Error("Banco indisponível"); return { _count: 2, _min: { price: 70000 }, _max: { price: 90000 }, _avg: { price: 80000 } }; } } } };
  return original.call(this, id, parent, isMain);
};
let GET: typeof import("../app/api/admin/fipe/route").GET;
try { ({ GET } = require("../app/api/admin/fipe/route.ts")); } finally { loader._load = original; }
beforeEach(() => { authenticated = true; stockFailure = false; aggregateArgs = undefined; calls = 0; });
const request = (params = "category=carro&brand=59&model=5940&year=2014-3&exclude=meu-carro") => new Request(`http://localhost/api/admin/fipe?${params}`);
const provider = { Marca: "VW - VolksWagen", Modelo: "AMAROK 2.0 Diesel", AnoModelo: 2014, Combustivel: "Diesel", Valor: "R$ 84.753,00", CodigoFipe: "005340-6", MesReferencia: "outubro de 2026" };

test("rota protege consulta e estoque antes de acessar integrações", async t => {
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json(provider); });
  authenticated = false;
  assert.equal((await GET(request())).status, 401);
  authenticated = true;
  assert.equal((await GET(request("category=carro&plate=ABC1234"))).status, 400);
  assert.equal(calls, 0);
  assert.equal(aggregateArgs, undefined);
});

test("consulta retorna referência e agregado apenas dos similares ativos, excluindo o próprio anúncio", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json(provider));
  const result = await GET(request());
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  const data = await result.json();
  assert.equal(data.vehicle.price, 84753);
  assert.deepEqual(data.stock, { count: 2, min: 70000, max: 90000, average: 80000 });
  assert.deepEqual((aggregateArgs as { where: unknown }).where, {
    category: "carro", brand: { equals: "Volkswagen", mode: "insensitive" }, model: { in: ["AMAROK"], mode: "insensitive" }, yearModel: 2014,
    status: { in: ["disponivel", "reservado"] }, historical: false, price: { gt: 0 }, id: { not: "meu-carro" },
  });
});

test("falha do estoque não impede FIPE; falha do provedor retorna erro recuperável", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(provider));
  stockFailure = true;
  assert.equal((await (await GET(request())).json()).stock, null);
  fetch.mock.mockImplementation(async () => new Response(null, { status: 429 }));
  const result = await GET(request());
  assert.equal(result.status, 502);
  assert.match((await result.json()).error, /Limite/);
});
