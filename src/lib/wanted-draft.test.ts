import test from "node:test";
import assert from "node:assert/strict";
import { parseWantedDraft, serializeWantedDraft, wantedDraftFields, WANTED_DRAFT_TTL } from "./wanted-draft";

test("pedido recupera somente texto, na mesma intenção de busca", () => {
  const fields = wantedDraftFields({ model: "Civic", phone: "27996330706", consent: "sim", interestVehicleId: "outro", sourcePage: "ficha" });
  const raw = serializeWantedDraft(fields, "Civic", 100);
  assert.equal(parseWantedDraft(raw, "Civic", 101)?.model, "Civic");
  assert.equal(parseWantedDraft(raw, "Duster", 101), null);
  assert.doesNotMatch(raw!, /consent|interestVehicleId|sourcePage/);
});
test("pedido rejeita rascunho inválido, expirado ou vazio", () => {
  const raw = serializeWantedDraft(wantedDraftFields({ model: "Civic" }), "", 100);
  assert.equal(parseWantedDraft(raw, "", 100 + WANTED_DRAFT_TTL), null);
  assert.equal(parseWantedDraft(raw, "", 99), null);
  assert.equal(parseWantedDraft("{", ""), null);
  assert.equal(serializeWantedDraft(wantedDraftFields({}), ""), null);
  assert.equal(wantedDraftFields({ name: "x".repeat(300) }).name.length, 120);
});
