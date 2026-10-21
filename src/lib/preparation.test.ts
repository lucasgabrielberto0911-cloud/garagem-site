import assert from "node:assert/strict";
import test from "node:test";
import { AWAITING_PUBLICATION_WHERE, publishBlockMessage } from "./preparation";

test("lista de aguardando publicação não filtra por preço (carro com preço salvo continua listado)", () => {
  assert.equal("price" in AWAITING_PUBLICATION_WHERE, false);
  assert.equal(AWAITING_PUBLICATION_WHERE.historical, true);
});

test("publicação: bloqueia preço zero e libera após salvar preço positivo", () => {
  assert.ok(publishBlockMessage(0));
  assert.equal(publishBlockMessage(45000), null);
});
