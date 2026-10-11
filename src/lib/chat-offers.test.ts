import assert from "node:assert/strict";
import { test } from "node:test";
import { guardUnaskedOffers } from "./chat-claims";
import { polishChatReplyWithCards } from "./chat-cards";
import { looksTruncated } from "./chat-polish";

const closing = "O HB20S tem 120 cv e porta-malas de 475 litros. Se quiser ver fotos extras ou falar sobre financiamento, o consultor te atende no WhatsApp.";

test("fechamento não puxa financiamento que o visitante não pediu", () => {
  const out = guardUnaskedOffers(closing, "como é o motor e o porta-malas do hb20s?");
  assert.match(out, /Se quiser ver fotos extras, o consultor te atende no WhatsApp\./);
  assert.doesNotMatch(out, /financiamento/);
  assert.match(out, /120 cv/);
  // Pediu parcela: fica.
  assert.equal(guardUnaskedOffers(closing, "e a parcela?"), closing);
  // Só financiamento: vira convite neutro e mantém o link.
  const only = guardUnaskedOffers("Bom carro. Pra falar sobre financiamento, chama no WhatsApp: https://wa.me/5527996330706", "tem ar?");
  assert.match(only, /Qualquer dúvida, o consultor te atende no WhatsApp: https:\/\/wa\.me\/5527996330706$/);
  // Troca não pedida some; frase sem WhatsApp fica intacta.
  assert.match(guardUnaskedOffers("Se quiser avaliar a troca ou ver fotos, chama no WhatsApp.", "tem câmera?"), /^Se quiser ver fotos, chama no WhatsApp\.$/);
  assert.equal(guardUnaskedOffers("O financiamento é em até 60x.", "tem câmera?"), "O financiamento é em até 60x.");
});

test("ranking compacto: linhas • ficam juntas e não ganham ponto final", () => {
  const reply = "Mais fortes (cv de fábrica) entre os carros automáticos:\n• Lancer 2.0 2014 — 160 cv\n• Civic EXL 2020 — 155 cv\n\nMitsubishi Lancer 2.0 2014 · 80.000 km · R$ 62.900";
  const cards = [
    { id: "a", href: "/estoque/a", title: "Mitsubishi Lancer", brand: "Mitsubishi", model: "Lancer", year: 2014, price: 62900, km: 80000 },
    { id: "b", href: "/estoque/b", title: "Honda Civic", brand: "Honda", model: "Civic", year: 2020, price: 126900, km: 65000 },
  ] as unknown as Parameters<typeof polishChatReplyWithCards>[1];
  assert.equal(
    polishChatReplyWithCards(reply, cards),
    "Mais fortes (cv de fábrica) entre os carros automáticos:\n\n• Lancer 2.0 2014 — 160 cv\n• Civic EXL 2020 — 155 cv",
  );
  assert.equal(looksTruncated("Os mais fortes:\n• Civic EXL 2020 — 155 cv"), false);
});

test("tira a oração inteira do assunto não pedido", () => {
  const out = guardUnaskedOffers(
    "O porta-malas tem 475 litros. Se quiser ver mais detalhes, fotos ou simular uma condição, o consultor te atende no WhatsApp",
    "Como é o motor, o câmbio e o porta-malas do HB20S?",
  );
  assert.match(out, /Se quiser ver mais detalhes, fotos, o consultor te atende no WhatsApp$/);
  assert.equal(
    guardUnaskedOffers("Se quiser ver fotos extras e vídeo ou falar sobre financiamento, chama no WhatsApp.", "tem câmera?"),
    "Se quiser ver fotos extras e vídeo, chama no WhatsApp.",
  );
});
