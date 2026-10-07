import test from "node:test";
import assert from "node:assert/strict";
import { requestJson } from "./request-json";

const stalled = () => new Promise<Response>(() => {});
test("conexão travada termina como timeout e cancela o transporte", async () => {
  let signal: AbortSignal | null | undefined;
  const fetcher: typeof fetch = (_url, init) => { signal = init?.signal; return stalled(); };
  await assert.rejects(requestJson("/api/estoque", {}, 10, fetcher), { name: "TimeoutError" });
  assert.equal(signal?.aborted, true);
});
test("o limite também cobre um corpo JSON que nunca termina", async () => {
  const fetcher = (async () => ({ ok: true, json: () => new Promise(() => {}) })) as typeof fetch;
  await assert.rejects(requestJson("/api/estoque", {}, 10, fetcher), { name: "TimeoutError" });
});
test("navegar ou mudar filtro cancela sem virar timeout", async () => {
  const controller = new AbortController();
  const request = requestJson("/api/estoque", { signal: controller.signal }, 1000, stalled);
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
  await assert.rejects(requestJson("/api/estoque", { signal: controller.signal }, 1000, stalled), { name: "AbortError" });
});
test("sucesso mantém o JSON e erro HTTP não vira lista vazia", async () => {
  assert.deepEqual(await requestJson("/api/estoque", {}, 1000, async () => Response.json({ vehicles: [] })), { vehicles: [] });
  await assert.rejects(requestJson("/api/estoque", {}, 1000, async () => new Response(null, { status: 500 })));
});
