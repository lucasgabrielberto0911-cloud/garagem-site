import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHONES,
  WHATSAPP_BRAND,
  WHATSAPP_MESSAGES,
  formatCustomerVehicleWhatsAppText,
  site,
  whatsappUrl,
} from "./site";

test("WhatsApp oficial continua no número da loja", () => {
  assert.equal(site.whatsappNumber, "5527996330706");
  assert.equal(PHONES[0].digits, "5527996330706");
  assert.match(whatsappUrl(), /^https:\/\/wa\.me\/5527996330706\?text=/);
});

test("CTA genérico do topo e da home no tom natural", () => {
  assert.equal(
    WHATSAPP_MESSAGES.general,
    "Oi! Vi o site da Garagem e gostaria de mais informações.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.help,
    "Oi! Vi o site da Garagem e quero ajuda pra escolher um seminovo.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.finance,
    "Oi! Vi o site da Garagem e quero simular as parcelas.",
  );
  assert.equal(WHATSAPP_BRAND, "Garagem");
  assert.doesNotMatch(WHATSAPP_MESSAGES.general, /Sua Garagem/);
  assert.doesNotMatch(WHATSAPP_MESSAGES.help, /Sua Garagem/);
});

test("helpers de veículo sem preço caem no fallback sem “por R$”", () => {
  assert.equal(
    WHATSAPP_MESSAGES.vehicle("Hyundai HB20 2022"),
    "Oi! Vi o Hyundai HB20 2022 no site da Garagem e quero saber mais.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.vehicleFinance("Hyundai HB20 2022"),
    "Oi! Vi o Hyundai HB20 2022 no site da Garagem e quero simular as parcelas.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.vehicleTrade("Honda BIZ 125 EX 2023", true),
    "Oi! Vi a Honda BIZ 125 EX 2023 no site da Garagem e quero avaliar uma troca.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.vehicleVideo("Honda BIZ 125 EX 2023", true),
    "Oi! Vi a Honda BIZ 125 EX 2023 no site da Garagem e queria um vídeo dela.",
  );
  assert.equal(
    formatCustomerVehicleWhatsAppText({
      intent: "interest",
      label: "",
      priceLabel: "R$ 64.900",
    }),
    "Oi! Vi o site da Garagem e gostaria de mais informações.",
  );
  assert.doesNotMatch(
    formatCustomerVehicleWhatsAppText({
      intent: "interest",
      label: "Hyundai HB20 2022",
      priceLabel: "   ",
    }),
    /por R\$/,
  );
});
