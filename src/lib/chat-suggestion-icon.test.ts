import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestionIconKind } from "./chat-suggestion-icon";

test("atalhos de preço usam R$; financiamento e troca não", () => {
  assert.equal(suggestionIconKind("Carros até 70 mil?"), "price");
  assert.equal(suggestionIconKind("Automático até 80 mil?"), "gear");
  assert.equal(suggestionIconKind("Como funciona o financiamento?"), "finance");
  assert.equal(suggestionIconKind("Dá para parcelar?"), "finance");
  assert.equal(suggestionIconKind("Aceita troca?"), "trade");
  assert.equal(suggestionIconKind("Pedir vídeo no WhatsApp"), "video");
  assert.equal(suggestionIconKind("Garantia e condições"), "warranty");
  assert.equal(suggestionIconKind("Falar com um consultor"), "whatsapp");
});
