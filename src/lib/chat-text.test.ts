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

test("mantém a quebra entre a comparação e o consumo", () => {
  const text =
    "Entre esses, o Palio Weekend é o mais em conta (R$ 47.900).\n\nConsumo de catálogo na cidade: Prisma e HB20 1.0 ~11–14 km/l.";
  assert.match(displayChatText(text), /\n\nConsumo/);
});

test("esconde o link seco e vira botão de WhatsApp com um ganho", () => {
  const finance =
    "A gente financia em até 60x. Parcela no WhatsApp: https://wa.me/5527996330706";
  assert.equal(displayChatText(finance).includes("wa.me"), false);
  assert.doesNotMatch(displayChatText(finance), /wa\.me/);
  assert.match(displayChatText(finance), /60x/);
  const financeCta = chatWhatsAppCta(finance);
  assert.equal(financeCta?.label, "Simular parcela");
  assert.match(financeCta?.benefit ?? "", /seu caso/);
  assert.match(financeCta?.href ?? "", /wa\.me\/5527996330706/);

  const trade =
    "Aceitamos carro ou moto na troca. Avaliação no WhatsApp: https://wa.me/5527996330706";
  assert.equal(chatWhatsAppCta(trade)?.label, "Avaliar meu usado");

  const tradeVehicle = chatWhatsAppCta(trade, {
    label: "Honda BIZ 125 EX 2023",
    model: "BIZ 125",
    category: "moto",
  });
  assert.equal(tradeVehicle?.label, "Avaliar meu usado");
  assert.match(decodeURIComponent(tradeVehicle?.href ?? ""), /Honda BIZ 125 EX 2023/);
  assert.match(decodeURIComponent(tradeVehicle?.href ?? ""), /usado na troca/);

  const financeVehicle = chatWhatsAppCta(finance, {
    label: "Honda BIZ 125 EX 2023",
    model: "BIZ 125",
    category: "moto",
  });
  assert.equal(financeVehicle?.label, "Simular parcela");
  assert.match(decodeURIComponent(financeVehicle?.href ?? ""), /Honda BIZ 125 EX 2023/);
});
