import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatWhatsAppCta,
  displayChatText,
  lastShownChatVehicles,
  lastSingleChatVehicleId,
  resolveChatRequestVehicleId,
  splitChatLinks,
} from "./chat-text";

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
  assert.match(decodeURIComponent(tradeVehicle?.href ?? ""), /veículo na troca/);

  const financeVehicle = chatWhatsAppCta(finance, {
    label: "Honda BIZ 125 EX 2023",
    model: "BIZ 125",
    category: "moto",
  });
  assert.equal(financeVehicle?.label, "Simular parcela");
  assert.match(decodeURIComponent(financeVehicle?.href ?? ""), /Honda BIZ 125 EX 2023/);

  const soldVehicle = chatWhatsAppCta("Chama no WhatsApp: https://wa.me/5527996330706", {
    label: "Hyundai i30",
    model: "i30",
    sold: true,
  });
  assert.equal(soldVehicle?.label, "Avisar quando chegar");
  assert.match(decodeURIComponent(soldVehicle?.href ?? ""), /quando chegar: Hyundai i30/);
});

test("vehicleId de follow-up só no esse/dele com um card, nunca no modelo nomeado", () => {
  const lastSingle = lastSingleChatVehicleId([
    { role: "assistant", vehicles: [{ id: "c-fox-1" }] },
  ]);
  assert.equal(lastSingle, "c-fox-1");
  assert.equal(
    lastSingleChatVehicleId([
      { role: "assistant", vehicles: [{ id: "a" }, { id: "b" }] },
    ]),
    undefined,
  );
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "qual o consumo dele?",
      lastSingleCardId: "c-fox-1",
    }),
    "c-fox-1",
  );
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "Qual consumo do fox",
      lastSingleCardId: "c-fox-1",
    }),
    undefined,
  );
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "qual o consumo dele?",
      pageVehicleId: "c-hb20-page",
      lastSingleCardId: "c-fox-1",
    }),
    "c-hb20-page",
  );
});

test("nomeia o Fox dos cards mostrados e não pega outro anúncio da lista", () => {
  const shown = [
    { id: "c-hb20-1", brand: "Hyundai", model: "HB20" },
    { id: "c-fox-1", brand: "Volkswagen", model: "Fox" },
    { id: "c-onix-1", brand: "Chevrolet", model: "Onix" },
  ];
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "Qual consumo do fox",
      shownCards: shown,
      lastSingleCardId: "c-hb20-1",
    }),
    "c-fox-1",
  );
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "Qual consumo do fox",
      shownCards: shown.slice(0, 1),
    }),
    undefined,
  );
  assert.deepEqual(
    lastShownChatVehicles([
      { role: "assistant", vehicles: shown },
      { role: "user" },
    ]).map((vehicle) => vehicle.id),
    ["c-hb20-1", "c-fox-1", "c-onix-1"],
  );
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "Qual consumo do fox",
      pageVehicleId: "c-hb20-page",
      shownCards: shown,
    }),
    "c-fox-1",
  );
});

