import assert from "node:assert/strict";
import test from "node:test";
import { chatVisitMessage, chatVisitWhatsAppUrl, isChatVisitComplete } from "./chat-visit";

const input = { vehicle: "Onix 2020", questions: "aceita troca?", time: "sábado de manhã" };

test("mensagem de visita traz carro, dúvidas e horário", () => {
  const msg = chatVisitMessage(input);
  assert.match(msg, /Onix 2020/);
  assert.match(msg, /aceita troca\?/);
  assert.match(msg, /sábado de manhã/);
  assert.doesNotMatch(msg, /Linhares|endereço/i);
});

test("link usa o WhatsApp do site e exige carro e horário", () => {
  assert.match(chatVisitWhatsAppUrl(input), /^https:\/\/wa\.me\/5527996330706\?text=/);
  assert.equal(isChatVisitComplete({ ...input, time: " " }), false);
  assert.equal(isChatVisitComplete({ ...input, questions: "" }), true);
});
