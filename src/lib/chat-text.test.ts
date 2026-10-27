import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatCtaIntent,
  chatCtaTopic,
  chatSessionHints,
  chatWhatsAppCta,
  displayChatText,
  formatChatHandoffMessage,
  lastShownChatVehicles,
  lastSingleChatVehicleId,
  resolveChatRequestVehicleId,
  splitChatLinks,
} from "./chat-text";
import { whatsappUrl } from "./site";

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
  assert.equal(financeCta?.label, "Falar sobre financiamento");
  assert.match(financeCta?.benefit ?? "", /seu caso/);
  assert.match(financeCta?.href ?? "", /wa\.me\/5527996330706/);
  assert.match(financeCta?.href ?? "", /utm_source=site/);
  assert.match(financeCta?.href ?? "", /utm_medium=whatsapp/);
  assert.match(financeCta?.href ?? "", /utm_campaign=chat/);
  assert.match(
    decodeURIComponent(financeCta?.href ?? ""),
    /Oi! Vi o site da Garagem e quero saber sobre o financiamento\./,
  );

  const trade =
    "Aceitamos carro ou moto na troca. Avaliação no WhatsApp: https://wa.me/5527996330706";
  assert.equal(chatWhatsAppCta(trade)?.label, "Avaliar minha troca");

  const tradeVehicle = chatWhatsAppCta(trade, {
    label: "Honda BIZ 125 EX 2023",
    model: "BIZ 125",
    category: "moto",
  });
  assert.equal(tradeVehicle?.label, "Avaliar minha troca");
  assert.match(decodeURIComponent(tradeVehicle?.href ?? ""), /Honda BIZ 125 EX 2023/);
  assert.match(decodeURIComponent(tradeVehicle?.href ?? ""), /avaliar uma troca/);

  const financeVehicle = chatWhatsAppCta(finance, {
    label: "Honda BIZ 125 EX 2023",
    model: "BIZ 125",
    category: "moto",
  });
  assert.equal(financeVehicle?.label, "Falar sobre financiamento");
  assert.match(decodeURIComponent(financeVehicle?.href ?? ""), /Honda BIZ 125 EX 2023/);

  const soldVehicle = chatWhatsAppCta("Chama no WhatsApp: https://wa.me/5527996330706", {
    label: "Hyundai i30",
    model: "i30",
    sold: true,
  });
  assert.equal(soldVehicle?.label, "Avisar quando chegar");
  assert.match(decodeURIComponent(soldVehicle?.href ?? ""), /quando chegar: Hyundai i30/);
});

test("CTA com preço e path manda R$ e o link do anúncio", () => {
  const cta = chatWhatsAppCta(
    "Chama no WhatsApp: https://wa.me/5527996330706",
    {
      label: "Hyundai HB20 2022",
      brand: "Hyundai",
      model: "HB20",
      year: 2022,
      price: 64900,
      path: "/estoque/hyundai-hb20-2022-xyz",
    },
  );
  const decoded = decodeURIComponent(cta?.href ?? "");
  assert.match(decoded, /R\$/);
  assert.match(decoded, /estoque\/hyundai-hb20-2022-xyz/);
  assert.match(
    decoded,
    /Oi! Vi o Hyundai HB20 2022 por R\$\s*64\.900 no site da Garagem e quero saber mais\./,
  );
  assert.doesNotMatch(decoded, /Sua Garagem/);
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

test("handoff de várias recomendações inclui os anos e só links de fichas válidos", () => {
  const message = formatChatHandoffMessage({ vehicles: [
    { brand: "Honda", model: "Civic", year: 2015, href: "/estoque/civic-2015" },
    { brand: "Fiat", model: "Palio", year: 2016, href: "/estoque/palio-2016" },
    { label: "Toyota Corolla 2017", year: 2017, href: "//externo.example/estoque/corolla" },
  ] });
  assert.match(message, /Honda Civic 2015, Fiat Palio 2016 e Toyota Corolla 2017/);
  assert.match(message, /https:\/\/www\.suagaragem\.net\/estoque\/civic-2015/);
  assert.match(message, /https:\/\/www\.suagaragem\.net\/estoque\/palio-2016/);
  assert.doesNotMatch(message, /externo\.example|2017 2017/);
});

test("handoff do chat leva marca, modelo, ano, link, câmbio e teto reais, com UTM", () => {
  const text = formatChatHandoffMessage({
    vehicles: [
      {
        brand: "Mitsubishi",
        model: "Lancer",
        version: "2.0",
        year: 2014,
        href: "/estoque/lancer-2014",
        category: "carro",
      },
    ],
    priceLimit: 109_000,
    transmission: "automatico",
  });
  assert.match(
    text,
    /Oi! Vi o Mitsubishi Lancer 2\.0 2014 automático até R\$\s*109\.000 no site da Garagem e quero saber mais\.\nhttps:\/\/www\.suagaragem\.net\/estoque\/lancer-2014/,
  );
  assert.equal(formatChatHandoffMessage({}), "Oi! Vi o site da Garagem e quero ajuda pra escolher um seminovo.");
  const href = whatsappUrl(text, { campaign: "chat" });
  assert.match(href, /utm_source=site/);
  assert.match(href, /utm_medium=whatsapp/);
  assert.match(href, /utm_campaign=chat/);
  assert.match(decodeURIComponent(href), /Mitsubishi Lancer 2\.0/);

  const hints = chatSessionHints([
    { role: "assistant", content: "Olha o HB20 por R$ 55.900." },
    { role: "user", content: "automático até 100 mil" },
    { role: "user", content: "quero mais forte" },
  ]);
  assert.equal(hints.priceLimit, 100_000);
  assert.equal(hints.transmission, "automatico");

  const cta = chatWhatsAppCta(
    "Chama no WhatsApp: https://wa.me/5527996330706",
    {
      label: "Mitsubishi Lancer 2.0",
      brand: "Mitsubishi",
      model: "Lancer",
      version: "2.0",
      year: 2014,
      price: 62_900,
      path: "/estoque/lancer",
    },
    {
      handoff: {
        vehicles: [
          { brand: "Mitsubishi", model: "Lancer", version: "2.0" },
        ],
        priceLimit: 109_000,
        transmission: "automatico",
      },
    },
  );
  assert.match(decodeURIComponent(cta?.href ?? ""), /Lancer 2\.0 automático até R\$\s*109\.000/);
  assert.match(cta?.href ?? "", /utm_campaign=chat/);
  assert.doesNotMatch(decodeURIComponent(cta?.href ?? ""), /Creta|inventad/);
});


test("botão do WhatsApp segue a pergunta do visitante, não a resposta", () => {
  const hb20s = {
    label: "Hyundai HB20S Platinum 2022",
    brand: "Hyundai",
    model: "HB20S",
    version: "Platinum 1.0 TGDI",
    year: 2022,
    price: 99900,
    path: "/estoque/hyundai-hb20s-2022-abc",
  };
  const reply =
    "O HB20S tem motor turbo de 120 cv, câmbio automático de 6 marchas e porta-malas de 475 litros. Se quiser ver fotos extras ou falar sobre financiamento, o consultor te atende no WhatsApp https://wa.me/5527996330706";
  const question = chatWhatsAppCta(reply, hb20s, {
    userText: "como é o motor, o câmbio e o porta-malas do hb20s?",
  });
  assert.equal(question?.label, "Perguntar sobre o HB20S");
  assert.equal(question?.benefit, "Tirar dúvidas com o consultor");
  const text = decodeURIComponent(question?.href ?? "");
  assert.match(text, /Hyundai HB20S/);
  assert.match(text, /tirar umas dúvidas sobre motor, câmbio e porta-malas/);
  assert.doesNotMatch(text, /parcela/);
  assert.match(question?.href ?? "", /utm_campaign=chat/);
  assert.match(text, /estoque\/hyundai-hb20s-2022-abc/);

  const cases: Array<[string, string]> = [
    ["dá pra financiar em 48x?", "Falar sobre financiamento"],
    ["aceita meu carro na troca?", "Avaliar minha troca"],
    ["posso agendar uma visita sábado?", "Agendar visita"],
    ["tem mais fotos do interior?", "Pedir mais fotos"],
    ["manda um vídeo dele?", "Pedir vídeo"],
  ];
  for (const [ask, label] of cases) {
    assert.equal(chatWhatsAppCta(reply, hb20s, { userText: ask })?.label, label, ask);
  }
  const finance = decodeURIComponent(chatWhatsAppCta(reply, hb20s, { userText: "qual a parcela?" })?.href ?? "");
  assert.match(finance, /HB20S.*saber sobre o financiamento/s);
  const visit = decodeURIComponent(chatWhatsAppCta(reply, hb20s, { userText: "quero agendar visita" })?.href ?? "");
  assert.match(visit, /HB20S.*de perto/s);
  const photos = decodeURIComponent(chatWhatsAppCta(reply, hb20s, { userText: "tem mais fotos?" })?.href ?? "");
  assert.match(photos, /HB20S.*mais fotos dele/s);

  // Sem carro e sem assunto claro: neutro.
  assert.equal(chatWhatsAppCta(reply, null, { userText: "oi, tudo bem?" })?.label, "Chamar consultor");
  // Moto: artigo feminino.
  assert.equal(
    chatWhatsAppCta(reply, { label: "Honda BIZ 125 EX 2023", model: "BIZ 125", category: "moto" }, { userText: "a biz é flex?" })?.label,
    "Perguntar sobre a BIZ 125",
  );
  // Vendido continua “Avisar quando chegar”, mesmo com pergunta de parcela.
  assert.equal(chatWhatsAppCta(reply, { ...hb20s, sold: true }, { userText: "qual a parcela?" })?.label, "Avisar quando chegar");
});

test("assunto do botão sai da pergunta", () => {
  assert.equal(chatCtaIntent("quanto fica a entrada?"), "finance");
  assert.equal(chatCtaIntent("pego meu usado na troca?"), "trade");
  assert.equal(chatCtaIntent("qual o consumo?"), "question");
  assert.equal(chatCtaTopic("e o consumo e o airbag?"), "consumo e segurança");
  assert.equal(chatCtaTopic("tem?"), "");
});

test("pergunta do carro vence o handoff da sessão (automático herdado)", () => {
  const cta = chatWhatsAppCta(
    "Ótimo carro. O consultor te atende no WhatsApp",
    { label: "Hyundai HB20S Comfort Plus 2024", brand: "Hyundai", model: "HB20S", year: 2024 },
    { userText: "Como é o motor do HB20S?", handoff: { vehicles: [{ brand: "Hyundai", model: "HB20S" }], transmission: "automatico" } },
  );
  assert.equal(cta?.label, "Perguntar sobre o HB20S");
});

test("follow-up sem card usa o carro do card anterior só pra parcela/troca/visita/fotos", () => {
  const prev = { label: "Hyundai HB20S Comfort Plus 2024", brand: "Hyundai", model: "HB20S", year: 2024 };
  const reply = "Aceitamos sim, avaliação no WhatsApp https://wa.me/5527996330706";
  const trade = chatWhatsAppCta(reply, null, { userText: "aceita meu gol na troca?", contextVehicle: prev });
  assert.equal(trade?.label, "Avaliar minha troca");
  assert.match(decodeURIComponent(trade?.href ?? ""), /HB20S.*avaliar uma troca/s);
  const photos = chatWhatsAppCta(reply, null, { userText: "tem mais fotos?", contextVehicle: prev });
  assert.match(decodeURIComponent(photos?.href ?? ""), /HB20S.*mais fotos dele/s);
  assert.match(decodeURIComponent(chatWhatsAppCta(reply, null, { userText: "tem mais fotos?" })?.href ?? ""), /queria mais fotos\./);
  // Pergunta geral não vira “Perguntar sobre o HB20S”.
  assert.equal(chatWhatsAppCta(reply, null, { userText: "vocês abrem domingo?", contextVehicle: prev })?.label, "Chamar consultor");
});
