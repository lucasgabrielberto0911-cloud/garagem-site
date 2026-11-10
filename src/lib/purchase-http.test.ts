import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { beforeEach, test } from "node:test";
import { PurchaseError } from "./purchase-input";

const require = createRequire(import.meta.url);
const loader = Module as unknown as { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
const original = loader._load;
let authenticated = true, enabled = true, schema = true, limited = false, calls = 0;
loader._load = function(id, parent, main) {
  if (id === "@/lib/auth") return { getSession: async () => authenticated ? { adminId: "criador" } : null };
  if (id === "./purchase-flags") return { isPurchaseEvaluatorEnabled: () => enabled };
  if (id === "./purchase-store") return { assertPurchaseSchema: async () => { calls++; if (!schema) throw new PurchaseError("Estrutura ausente.", 503); } };
  if (id === "@/lib/admin-login-limit") return { checkSharedLimit: async () => ({ ok: !limited, retryAfterSec: 60 }) };
  return original.call(this, id, parent, main);
};
let access: typeof import("./purchase-http").withPurchaseAccess, body: typeof import("./purchase-http").purchaseBody;
try { const loaded = require("./purchase-http.ts"); access = loaded.withPurchaseAccess; body = loaded.purchaseBody; } finally { loader._load = original; }
beforeEach(() => { authenticated = true; enabled = true; schema = true; limited = false; calls = 0; });
const request = (origin: string | null = "https://admin.test") => new Request("https://admin.test/api/admin/compra", { method: "POST", headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": "application/json" }, body: "{}" });

test("sessão, flag e origem bloqueiam antes de consultar estrutura; respostas sempre privadas", async () => {
  const action = async () => { throw new Error("Não deveria executar"); };
  authenticated = false;
  const anonymous = await access(request(), action); assert.equal(anonymous.status, 401); assert.equal(anonymous.headers.get("cache-control"), "private, no-store");
  authenticated = true; enabled = false;
  assert.equal((await access(request(), action)).status, 503);
  enabled = true;
  assert.equal((await access(request("https://externo.test"), action)).status, 403);
  assert.equal((await access(request(null), action)).status, 403);
  assert.equal(calls, 0);
});
test("schema ausente e limite compartilhado degradam sem sucesso falso", async () => {
  schema = false; assert.equal((await access(request(), async () => ({ saved: true }))).status, 503);
  schema = true; limited = true;
  const response = await access(request(), async () => ({ saved: true })); assert.equal(response.status, 429); assert.equal(response.headers.get("Retry-After"), "60");
  limited = false;
  assert.deepEqual(await (await access(request(), async id => ({ id }))).json(), { id: "criador" });
});
test("JSON malformado, MIME indevido e corpo acima do limite são rejeitados", async () => {
  await assert.rejects(body(new Request("https://admin.test", { method: "POST", body: "{}" })));
  await assert.rejects(body(new Request("https://admin.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })));
  await assert.rejects(body(new Request("https://admin.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(65000) }) })));
});
