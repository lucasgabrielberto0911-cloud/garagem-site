import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCurrencyBRL } from "./format";
import {
  CHAT_WHATSAPP_URL,
  GREETING_TEMPLATES,
  EMPTY_STOCK_REPLIES,
  SOLD_VEHICLE_REPLIES,
  LEAD_CAPTURE_REPLIES,
  ABUSE_LIMIT_REPLIES,
  CARD_FORMATTERS,
} from "./chat-replies";

test("chat-replies: templates de saudação e contato contêm WhatsApp oficial", () => {
  assert.ok(CHAT_WHATSAPP_URL.startsWith("https://wa.me/"));
  assert.ok(GREETING_TEMPLATES.ping.length > 0);
  assert.ok(GREETING_TEMPLATES.hours.includes(CHAT_WHATSAPP_URL));
  assert.ok(GREETING_TEMPLATES.contact.includes(CHAT_WHATSAPP_URL));
  assert.ok(GREETING_TEMPLATES.social.includes(CHAT_WHATSAPP_URL));
});

test("chat-replies: respostas de estoque vazio e fallbacks", () => {
  assert.ok(EMPTY_STOCK_REPLIES.fallback.includes(CHAT_WHATSAPP_URL));
  assert.ok(EMPTY_STOCK_REPLIES.availabilityAsk.length > 0);
  assert.ok(EMPTY_STOCK_REPLIES.compareAsk.length > 0);
  assert.ok(EMPTY_STOCK_REPLIES.zeroKm.includes("seminovos"));

  const replySemSimilar = EMPTY_STOCK_REPLIES.missingModel("Civic", "https://wa.me/123", false);
  assert.ok(replySemSimilar.includes("Civic não está na lista atual"));
  assert.ok(replySemSimilar.includes("Posso olhar outro na mesma ideia"));

  const replyComSimilar = EMPTY_STOCK_REPLIES.missingModel(null, "https://wa.me/123", true);
  assert.ok(replyComSimilar.includes("Esse modelo não está na lista atual"));
  assert.ok(replyComSimilar.includes("Separei parecidos"));
});

test("chat-replies: avisos de veículo vendido nunca mostram preço", () => {
  const aviso = SOLD_VEHICLE_REPLIES.soldNotice("Onix 2021", "https://wa.me/123", true);
  assert.ok(aviso.includes("O Onix 2021 já foi vendido."));
  assert.ok(aviso.includes("Separei opções parecidas"));
  assert.ok(!aviso.includes("R$"));

  assert.ok(SOLD_VEHICLE_REPLIES.unitUnavailable.includes("Essa unidade já saiu"));
});

test("chat-replies: captura de lead e limites de uso", () => {
  assert.ok(LEAD_CAPTURE_REPLIES.confirmation.includes("registrei seu contato"));
  assert.ok(ABUSE_LIMIT_REPLIES.rateLimited.includes(CHAT_WHATSAPP_URL));
  assert.ok(ABUSE_LIMIT_REPLIES.offScope.includes(CHAT_WHATSAPP_URL));
  assert.ok(ABUSE_LIMIT_REPLIES.offScopeRepeat.includes(CHAT_WHATSAPP_URL));
});

test("chat-replies: CARD_FORMATTERS formata dados de veículo com precisão", () => {
  const v1 = {
    title: "Honda Civic",
    model: "Civic",
    version: "EXL 2.0 Flex",
    year: 2020,
    km: 45000,
    price: 115000,
    sold: false,
    transmission: "Automático CVT",
  };

  assert.equal(CARD_FORMATTERS.km(v1), "45 mil km");
  assert.equal(CARD_FORMATTERS.gear(v1), "Auto");
  assert.equal(CARD_FORMATTERS.price(v1), formatCurrencyBRL(115000));
  assert.equal(CARD_FORMATTERS.version(v1), "EXL 2.0 Flex");
  assert.equal(CARD_FORMATTERS.label(v1), "Honda Civic EXL 2.0 Flex 2020");
  assert.equal(CARD_FORMATTERS.meta(v1), "2020 · 45 mil · Auto");

  const v2 = {
    km: 8500,
    price: 50000,
    sold: true,
    transmission: "Manual",
  };
  assert.equal(CARD_FORMATTERS.km(v2), "8.500 km");
  assert.equal(CARD_FORMATTERS.gear(v2), "Manual");
  assert.equal(CARD_FORMATTERS.price(v2), "Vendido");
});
