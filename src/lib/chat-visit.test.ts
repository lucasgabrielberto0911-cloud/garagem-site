import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  VISIT_TIME_OPTIONS,
  chatVisitMessage,
  chatVisitWhatsAppUrl,
  isChatVisitComplete,
} from "./chat-visit";

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

test("sugestões rápidas de horário completam o agendamento e estão na ficha e no chat", () => {
  assert.deepEqual(VISIT_TIME_OPTIONS, [
    "Hoje à tarde",
    "Amanhã de manhã",
    "Amanhã à tarde",
    "Sábado de manhã",
  ]);
  for (const option of VISIT_TIME_OPTIONS) {
    assert.equal(
      isChatVisitComplete({ vehicle: "Honda Civic 2015", questions: "", time: option }),
      true,
    );
  }
  const panel = readFileSync("src/components/site/ChatVisitPanel.tsx", "utf8");
  const actions = readFileSync("src/components/site/VehicleQuickActions.tsx", "utf8");
  const ficha = readFileSync("src/app/(vehicle)/estoque/[id]/page.tsx", "utf8");
  assert.match(panel, /VISIT_TIME_OPTIONS/);
  assert.match(actions, /trackingLabel: "ficha-visit"/);
  assert.match(actions, /label: "Agendar visita"/);
  assert.match(ficha, /visit=\{whatsapp\.visit\}/);
});
