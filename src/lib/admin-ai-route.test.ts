import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { beforeEach, test } from "node:test";
import { AdminAiInputError } from "./admin-ai/service";

const loader = Module as unknown as { _load: (id: string, parent: unknown, main: boolean) => unknown }, original = loader._load;
let authenticated = true, limited = false, calls = 0, failure: Error | null = null;
loader._load = function(id, parent, main) {
  if (id === "@/lib/auth") return { getSession: async () => authenticated ? { adminId: "admin-ficticio" } : null };
  if (id === "@/lib/admin-login-limit") return { checkSharedLimit: async () => ({ ok: !limited, retryAfterSec: 60 }) };
  if (id === "@/lib/admin-ai/service") return { AdminAiInputError, runAdminAi: async () => { calls++; if (failure) throw failure; return { suggestions: [] }; } };
  return original.call(this, id, parent, main);
};
let post: typeof import("../app/api/admin/ia/[feature]/route").POST;
try { post = createRequire(import.meta.url)("../app/api/admin/ia/[feature]/route.ts").POST; } finally { loader._load = original; }
beforeEach(() => { authenticated = true; limited = false; calls = 0; failure = null; });
const context = { params: Promise.resolve({ feature: "revisar-texto" }) };
const request = (body = "{}", origin: string | null = "https://admin.test", contentType = "application/json") => new Request("https://admin.test/api/admin/ia/revisar-texto", { method: "POST", headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": contentType }, body });

test("API exige sessão e origem, limita por admin e nunca permite cache público", async () => {
  authenticated = false; assert.equal((await post(request(), context)).status, 401);
  authenticated = true;
  for (const origin of [null, "https://externo.test"]) assert.equal((await post(request("{}", origin), context)).status, 403);
  limited = true;
  const response = await post(request(), context);
  assert.equal(response.status, 429); assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(calls, 0);
  limited = false;
  const ok = await post(request(), context);
  assert.equal(ok.status, 200); assert.equal(ok.headers.get("Cache-Control"), "private, no-store");
});
test("API rejeita MIME, JSON, arrays, recurso desconhecido e tamanho real sem Content-Length", async () => {
  for (const body of ["{", "[]", "null"]) assert.equal((await post(request(body), context)).status, 400);
  assert.equal((await post(request("{}", "https://admin.test", "text/plain"), context)).status, 400);
  assert.equal((await post(request(JSON.stringify({ text: "a".repeat(24001) })), context)).status, 413);
  assert.equal((await post(request(), { params: Promise.resolve({ feature: "outro" }) })).status, 404);
  assert.equal(calls, 0);
});
test("erros não vazam provedor nem chave; bloqueio de legenda explica divergência", async () => {
  failure = new Error("segredo do provedor");
  const response = await post(request(), context);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes("segredo"));
  failure = new AdminAiInputError("Proposta bloqueada: equipamento não conferido.");
  const blocked = await post(request(), context); assert.equal(blocked.status, 422); assert.match(await blocked.text(), /bloqueada/);
});
