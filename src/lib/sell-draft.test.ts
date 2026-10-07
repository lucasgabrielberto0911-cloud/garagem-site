import test from "node:test";
import assert from "node:assert/strict";
import { parseSellDraft, serializeSellDraft, sellDraftFields, SELL_DRAFT_TTL } from "./sell-draft";

test("rascunho guarda só texto permitido, sem foto, referência privada ou interesse", () => {
  const fields = sellDraftFields({ name: "Cliente", phone: "(27) 90000-0000", model: "Civic", photoUrls: ["private:path"], photos: "file", interestVehicleId: "carro", website: "bot" });
  const raw = serializeSellDraft(fields, 100);
  assert.ok(raw); assert.deepEqual(parseSellDraft(raw, 101), fields);
  for (const forbidden of ["photoUrls", "private:path", "photos", "interestVehicleId", "website"]) assert.equal(raw.includes(forbidden), false);
});
test("rascunho expirado, futuro, inválido ou vazio não é recuperado", () => {
  const raw = serializeSellDraft(sellDraftFields({ brand: "Honda" }), 100);
  assert.equal(parseSellDraft(raw, 100 + SELL_DRAFT_TTL), null);
  assert.equal(parseSellDraft(raw, 99), null);
  for (const input of [null, "{", "[]", '{"version":2}', '{"version":1,"savedAt":100,"fields":[]}']) assert.equal(parseSellDraft(input, 101), null);
  assert.equal(serializeSellDraft(sellDraftFields({})), null);
});
test("tipos e tamanho são limitados sem levar valores extras para o formulário", () => {
  const fields = sellDraftFields({ name: "x".repeat(1000), phone: { attack: true }, notes: "n".repeat(3000), __proto__: { model: "herdado" } });
  assert.equal(fields.name.length, 120); assert.equal(fields.notes.length, 2000); assert.equal(fields.phone, "");
  assert.equal(fields.model, "");
});
