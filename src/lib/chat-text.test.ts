import assert from "node:assert/strict";
import { test } from "node:test";
import { chatWhatsAppCta, displayChatText, splitChatLinks } from "./chat-text";

test("transforma o wa.me em link com rótulo WhatsApp", () => {
  const parts = splitChatLinks(
    "Chama no WhatsApp: https://wa.me/5527996330706 agora.",
  );
  assert.deepEqual(parts, [
    { type: "text", value: "Chama no WhatsApp: " },
    {
      type: "link",
      href: "https://wa.me/5527996330706",
      label: "WhatsApp",
    },
    { type: "text", value: " agora." },
  ]);
});

test("esconde o link seco e vira botão de WhatsApp com um ganho", () => {
  const finance =
    "A gente financia em até 60x. Parcela no WhatsApp: https://wa.me/5527996330706";
  assert.equal(displayChatText(finance).includes("wa.me"), false);
  assert.doesNotMatch(displayChatText(finance), /wa\.me/);
  assert.match(displayChatText(finance), /60x/);
  const financeCta = chatWhatsAppCta(finance);
  assert.equal(financeCta?.label, "Simular parcela");
  assert.match(financeCta?.benefit ?? "", /perfil/);
  assert.match(financeCta?.href ?? "", /wa\.me\/5527996330706/);

  const trade =
    "Aceitamos carro ou moto na troca. Avaliação no WhatsApp: https://wa.me/5527996330706";
  assert.equal(chatWhatsAppCta(trade)?.label, "Avaliar meu usado");
});
