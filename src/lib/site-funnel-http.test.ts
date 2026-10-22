import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { POST } from "../app/api/funil/route";
import { prisma } from "./prisma";
import { mockPrismaMethod } from "./test-mock";

const valid = JSON.stringify({ event: "visita", origin: "google" });

function setup(t: TestContext, count = 1) {
  for (const [key, value] of Object.entries({
    UPSTASH_REDIS_REST_URL: "https://contador.test",
    UPSTASH_REDIS_REST_TOKEN: "credencial-ficticia",
    DATABASE_URL: "",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  t.mock.method(globalThis, "fetch", async () => Response.json([{ result: count }, { result: 1 }]));
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
  return mockPrismaMethod(t, prisma.adminAudit, "create", async () => ({}));
}

function request(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request("https://garagem.test/api/funil", {
    method: "POST",
    headers: { origin: "https://garagem.test", ...headers },
    body,
    duplex: "half",
  } as RequestInit);
}

function stream(chunks: string[], state: { reads: number; cancelled: boolean }) {
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      state.reads++;
      const chunk = chunks.shift();
      if (chunk === undefined) controller.close();
      else controller.enqueue(new TextEncoder().encode(chunk));
    },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
}

test("funil aplica rate limit antes de ler corpo ou gravar evento", async (t) => {
  const write = setup(t, 31);
  const state = { reads: 0, cancelled: false };
  const response = await POST(request(stream([valid], state)));
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("Retry-After")) > 0);
  assert.equal(state.reads, 0);
  assert.equal(write.mock.callCount(), 0);
});

test("funil limita bytes sem content-length e cancela stream assim que excede", async (t) => {
  const write = setup(t);
  for (const headers of [{} as Record<string, string>, { "content-length": "1" }]) {
    const state = { reads: 0, cancelled: false };
    const response = await POST(request(stream(["á".repeat(512), "á", valid], state), headers));
    assert.equal(response.status, 413);
    assert.equal(state.reads, 2);
    assert.equal(state.cancelled, true);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("funil aceita exatamente 1024 bytes e UTF-8 dividido entre chunks", async (t) => {
  const write = setup(t);
  const payload = valid.slice(0, -1) + ',"extra":"á"}';
  const bytes = new TextEncoder().encode(payload.padEnd(1024 - (new TextEncoder().encode(payload).length - payload.length)));
  assert.equal(bytes.byteLength, 1024);
  const split = bytes.indexOf(0xc3) + 1;
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(bytes.slice(0, split));
    controller.enqueue(bytes.slice(split));
    controller.close();
  } });
  assert.equal((await POST(request(body))).status, 204);
  assert.equal(write.mock.callCount(), 1);
});

test("funil rejeita tamanho declarado sem consumir corpo", async (t) => {
  setup(t);
  const state = { reads: 0, cancelled: false };
  assert.equal((await POST(request(stream([valid], state), { "content-length": "1025" }))).status, 413);
  assert.equal(state.reads, 0);
});

test("funil retorna 400 para JSON inválido, dados inválidos e veículo inexistente", async (t) => {
  const write = setup(t);
  mockPrismaMethod(t, prisma.vehicle, "findFirst", async () => null);
  for (const body of ["{", "", "{}", JSON.stringify({ event: "visita", origin: "google", vehicleId: "cmt0ewzpg0000lc0493fl02h7" })]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});

test("funil retorna 503 para falha de banco na consulta ou gravação", async (t) => {
  setup(t);
  mockPrismaMethod(t, prisma.adminAudit, "create", async () => { throw new Error("fora"); });
  assert.equal((await POST(request(valid))).status, 503);
  mockPrismaMethod(t, prisma.vehicle, "findFirst", async () => { throw new Error("fora"); });
  assert.equal((await POST(request(JSON.stringify({ event: "visita", origin: "google", vehicleId: "cmt0ewzpg0000lc0493fl02h7" })))).status, 503);
});

test("funil retorna 503 sem consumir corpo se limitador fica indisponível", async (t) => {
  const write = setup(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("fora"); });
  const state = { reads: 0, cancelled: false };
  const response = await POST(request(stream([valid], state)));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(state.reads, 0);
  assert.equal(write.mock.callCount(), 0);
});

test("funil rejeita origem externa antes de chamar dependências", async (t) => {
  const write = setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Não deve chamar"); });
  assert.equal((await POST(request(valid, { origin: "https://externo.test" }))).status, 403);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
});
