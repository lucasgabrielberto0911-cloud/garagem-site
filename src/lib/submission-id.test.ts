import assert from "node:assert/strict";
import { test } from "node:test";
import { submissionId } from "./submission-id";

test("chave sobrevive à perda da resposta, não guarda dados pessoais e muda após sucesso", async t => {
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "sessionStorage", previous); else Reflect.deleteProperty(globalThis, "sessionStorage"); });
  const form = () => { const data = new FormData(); data.set("name", "Emitente Fictício"); data.set("amount", "100,00"); return data; };
  const first = form(); const clear = await submissionId(first, "teste");
  const retry = form(); await submissionId(retry, "teste");
  assert.equal(first.get("requestId"), retry.get("requestId"));
  await submissionId(retry, "teste");
  assert.equal(first.get("requestId"), retry.get("requestId"));
  assert.ok(!JSON.stringify([...values]).includes("Emitente"));
  const changed = form(); changed.set("amount", "200,00"); await submissionId(changed, "teste");
  assert.notEqual(first.get("requestId"), changed.get("requestId"));
  clear();
  const next = form(); await submissionId(next, "teste");
  assert.notEqual(first.get("requestId"), next.get("requestId"));
});

test("armazenamento bloqueado impede envio sem chave persistente", async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get: () => { throw new Error("Armazenamento bloqueado"); } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "sessionStorage", previous); else Reflect.deleteProperty(globalThis, "sessionStorage"); });
  await assert.rejects(submissionId(new FormData(), "teste"), /bloqueado/);
});
