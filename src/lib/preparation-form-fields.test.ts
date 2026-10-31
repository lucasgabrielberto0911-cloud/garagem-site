import assert from "node:assert/strict";
import test from "node:test";
import { checkedFieldValue } from "./preparation-form-fields";

test("checkbox ausente em fields conta como desmarcado, mesmo com fallback true", () => {
  assert.equal(checkedFieldValue({ nome: "x" }, "ativo", true), false);
});
test("checkbox 'on' em fields conta como marcado", () => {
  assert.equal(checkedFieldValue({ ativo: "on" }, "ativo", false), true);
});
test("sem fields usa o fallback", () => {
  assert.equal(checkedFieldValue(undefined, "ativo", true), true);
  assert.equal(checkedFieldValue(undefined, "ativo"), false);
});
