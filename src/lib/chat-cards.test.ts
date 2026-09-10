import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatFollowupsAfterCards,
  chatStockExploreHref,
  chatStockExploreLabel,
  chatVehicleGear,
  chatVehicleKm,
  chatVehicleMeta,
  isBareBudgetQuery,
  isChatVehicleListingLine,
  looksLikeLooseVehicleTitle,
  matchVehiclesInReply,
  polishChatReplyWithCards,
  selectChatVehicles,
  stripChatVehicleListingLines,
  toChatVehicleCard,
} from "./chat-cards";
import type { ChatVehicleRecord } from "./chat-stock";

const biz: ChatVehicleRecord = {
  id: "cbiz125garagem00000000001",
  brand: "Honda",
  model: "BIZ 125",
  version: "EX 125 FLEX",
  yearModel: 2023,
  km: 22000,
  price: 17900,
  color: "Vermelha",
  transmission: "Manual",
  fuel: "Flex",
  category: "moto",
  photos: [
    {
      url: "https://cdn.example/biz.jpg",
      thumbnailUrl: "https://cdn.example/biz-card.webp",
    },
  ],
};

const prisma: ChatVehicleRecord = {
  id: "cprismajoygaragem0000001",
  brand: "Chevrolet",
  model: "Prisma",
  version: "Sed. Joy/LS 1.0",
  yearModel: 2019,
  km: 152000,
  price: 52900,
  color: "Prata",
  transmission: "Manual",
  fuel: "Flex",
  photos: [],
  category: "carro",
};

const compass: ChatVehicleRecord = {
  id: "ccompassgaragem000000001",
  brand: "Jeep",
  model: "Compass",
  version: "Longitude",
  yearModel: 2022,
  km: 40000,
  price: 129900,
  color: "Branco",
  transmission: "Automático",
  fuel: "Flex",
  category: "carro",
};

const LIST = `Até R$ 70.000 estes cabem no orçamento. Eu começaria por estes:
Honda BIZ 125 EX 125 FLEX 2023 · 22.000 km · R$ 17.900 — mais em conta, menor km
Chevrolet Prisma Sed. Joy/LS 1.0 8V FlexPower 4p 2019 · 152.000 km · R$ 52.900
Tem o mais em conta, o de menor km e automático se houver.`;

test("linha de estoque vira mini-anúncio e some da lista seca", () => {
  assert.equal(isChatVehicleListingLine("Honda BIZ 125 EX 125 FLEX 2023 · 22.000 km · R$ 17.900"), true);
  assert.equal(
    isChatVehicleListingLine(
      "Temos o Honda BIZ 125 EX 125 FLEX 2023, 22000 km, R$ 17900.",
    ),
    false,
  );
  const stripped = stripChatVehicleListingLines(LIST);
  assert.match(stripped, /70\.000/);
  assert.doesNotMatch(stripped, /BIZ 125/);
  assert.doesNotMatch(stripped, /Prisma/);
  assert.match(stripped, /mais em conta/);
});

test("casa a lista do assistente com foto, preço, ano, cor, km e link do anúncio", () => {
  const matched = matchVehiclesInReply(LIST, [biz, prisma, compass]);
  assert.deepEqual(
    matched.map((vehicle) => vehicle.id),
    [biz.id, prisma.id],
  );
  const card = toChatVehicleCard(biz);
  assert.equal(card.title, "Honda BIZ 125");
  assert.equal(card.year, 2023);
  assert.equal(card.km, 22000);
  assert.equal(card.price, 17900);
  assert.equal(card.color, "Vermelha");
  assert.equal(card.brand, "Honda");
  assert.equal(card.model, "BIZ 125");
  assert.equal(card.photo, "https://cdn.example/biz-card.webp");
  assert.equal(card.transmission, "Manual");
  assert.match(card.href, /^\/estoque\/honda-biz-125/);
  assert.equal(card.href.includes(biz.id), true);
});

test("tira título solto quando o mini-anúncio já cobre o carro", () => {
  const leftover = `Aqui estão algumas opções até R$ 70.000:
Mitsubishi LANCER 2.0
Fiat Palio Weekend Adventure 1.8 Flex 16V 2016 · 156.400 km · R$ 47.900`;
  const palio: ChatVehicleRecord = {
    id: "cpaliogaragem000000000001",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    yearModel: 2016,
    km: 156400,
    price: 47900,
    color: "Branca",
    transmission: "Manual",
    fuel: "Flex",
  };
  const cards = matchVehiclesInReply(leftover, [palio]).map(toChatVehicleCard);
  assert.equal(cards[0]?.id, palio.id);
  const stripped = stripChatVehicleListingLines(leftover, cards);
  assert.match(stripped, /70\.000/);
  assert.doesNotMatch(stripped, /LANCER/);
  assert.doesNotMatch(stripped, /Palio/);
});

test("faixa de preço completa anúncios se o texto citou poucos", () => {
  const onix: ChatVehicleRecord = {
    ...prisma,
    id: "conixgaragem0000000000001",
    model: "Onix",
    price: 39900,
  };
  const picked = selectChatVehicles(
    "Chevrolet Prisma Sed. Joy/LS 1.0 8V FlexPower 4p 2019 · 152.000 km · R$ 52.900",
    "Quais carros até 70 mil?",
    [biz, prisma, compass, onix],
  );
  assert.deepEqual(
    picked.map((vehicle) => vehicle.id),
    [onix.id, prisma.id],
  );
  assert.equal(
    picked.some((vehicle) => vehicle.id === biz.id),
    false,
  );
});

test("orçamento genérico ignora carro acima da faixa e aponta o estoque", () => {
  assert.equal(isBareBudgetQuery("Quais carros até 70 mil?"), true);
  assert.equal(isBareBudgetQuery("Tem Prisma até 70 mil?"), false);
  const extra: ChatVehicleRecord = {
    ...prisma,
    id: "conixgaragem0000000000001",
    model: "Onix",
    price: 39900,
  };
  const picked = selectChatVehicles(
    "Jeep Compass Longitude 2022 · 40.000 km · R$ 129.900",
    "Quais carros até 70 mil?",
    [biz, prisma, compass, extra],
  );
  assert.deepEqual(
    picked.map((vehicle) => vehicle.id),
    [extra.id, prisma.id],
  );
  assert.equal(
    picked.some((vehicle) => vehicle.id === compass.id || vehicle.id === biz.id),
    false,
  );
  assert.equal(
    chatStockExploreHref("Quais carros até 70 mil?", [biz, prisma, compass, extra], 2),
    null,
  );
  assert.equal(
    chatStockExploreHref(
      "Quais carros até 70 mil?",
      [biz, prisma, compass, extra, { ...extra, id: "cextra2garagem0000000001", price: 25000 }],
      2,
    ),
    "/estoque?maxPrice=70000&category=carro",
  );
  assert.match(chatStockExploreLabel("/estoque?maxPrice=70000"), /70\.000/);
});

test("pedido de modelo na faixa mantém o carro citado na frente", () => {
  const onix: ChatVehicleRecord = {
    ...prisma,
    id: "conixgaragem0000000000001",
    model: "Onix",
    price: 39900,
  };
  const picked = selectChatVehicles(
    "Chevrolet Prisma Sed. Joy/LS 1.0 8V FlexPower 4p 2019 · 152.000 km · R$ 52.900",
    "Tem Prisma até 70 mil?",
    [biz, prisma, compass, onix],
  );
  assert.equal(picked[0]?.id, prisma.id);
  assert.equal(picked[1]?.id, onix.id);
  assert.equal(
    picked.some((vehicle) => vehicle.id === biz.id),
    false,
  );
});

test("automático na faixa não mistura manual", () => {
  const auto: ChatVehicleRecord = {
    ...prisma,
    id: "conixautogaragem00000001",
    model: "Onix",
    transmission: "Automático",
    price: 55900,
  };
  assert.equal(isBareBudgetQuery("Automático até 80 mil?"), true);
  const picked = selectChatVehicles(
    "Chevrolet Prisma Sed. Joy/LS 1.0 8V FlexPower 4p 2019 · 152.000 km · R$ 52.900",
    "Automático até 80 mil?",
    [biz, prisma, compass, auto],
  );
  assert.deepEqual(
    picked.map((vehicle) => vehicle.id),
    [auto.id],
  );
  assert.match(
    chatStockExploreHref("Automático até 80 mil?", [biz, prisma, compass, auto], 0) ?? "",
    /transmission=Autom%C3%A1tico|transmission=Automático/,
  );
  assert.equal(
    chatStockExploreHref("Como funciona o financiamento?", [biz, prisma, compass], 0),
    null,
  );
  assert.equal(chatStockExploreHref("Aceita troca?", [biz, prisma], 0), null);
});

test("pedido de moto na faixa não mistura carro", () => {
  const picked = selectChatVehicles(
    "Honda BIZ 125 EX 125 FLEX 2023 · 22.000 km · R$ 17.900",
    "Tem moto até 20 mil?",
    [biz, prisma, compass],
  );
  assert.deepEqual(
    picked.map((vehicle) => vehicle.id),
    [biz.id],
  );
});

test("com cards, a bolha some lista extra e fica só o gancho", () => {
  const leftover = `Até R$ 70.000 estes cabem no orçamento.
Fiat Palio Weekend Adventure 1.8 Flex 16V 2016 · 156.400 km · R$ 47.900
Também tem Chevrolet Onix e Mitsubishi Lancer se quiser esticar.
Tem o mais em conta, o de menor km e automático se houver.
Qual desses estilos você prefere, hatch ou sedan?
Qual perfil te serve?`;
  const palio: ChatVehicleRecord = {
    id: "cpaliogaragem000000000001",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    yearModel: 2016,
    km: 156400,
    price: 47900,
    color: "Branca",
    transmission: "Manual",
    fuel: "Flex",
    category: "carro",
  };
  const cards = [toChatVehicleCard(palio), toChatVehicleCard(prisma)];
  const polished = polishChatReplyWithCards(leftover, cards);
  assert.match(polished, /70\.000/);
  assert.doesNotMatch(polished, /perfil/);
  assert.doesNotMatch(polished, /hatch/);
  assert.doesNotMatch(polished, /qual desses/i);
  assert.doesNotMatch(polished, /Onix/);
  assert.doesNotMatch(polished, /Lancer/);
  assert.doesNotMatch(polished, /156\.400/);
  assert.deepEqual(
    chatFollowupsAfterCards("/estoque?maxPrice=70000&category=carro", cards),
    ["Automático até 70 mil?", "Dá para parcelar?", "Aceita troca?"],
  );
  assert.equal(chatVehicleKm(cards[0]!), "156 mil km");
  assert.equal(chatVehicleKm(cards[0]!, { compact: true }), "156 mil");
  assert.equal(chatVehicleGear(cards[0]!), "Manual");
  assert.equal(chatVehicleMeta(cards[0]!), "2016 · 156 mil · Manual");
  assert.equal(
    chatVehicleGear(
      toChatVehicleCard({ ...prisma, transmission: "Automático" }),
    ),
    "Auto",
  );
  assert.deepEqual(chatFollowupsAfterCards(null, cards), [
    "Tem automático?",
    "Dá para parcelar?",
    "Aceita troca?",
  ]);
  const autoCards = [
    toChatVehicleCard({
      ...prisma,
      id: "cautogaragem0000000000001",
      model: "Onix",
      transmission: "Automático",
      price: 56900,
    }),
  ];
  assert.deepEqual(chatFollowupsAfterCards(null, autoCards), [
    "Dá para parcelar?",
    "Aceita troca?",
  ]);
});

test("baratinho do HB20 não puxa irmão caro", () => {
  const cheapHb20: ChatVehicleRecord = {
    ...prisma,
    id: "chb20barato0000000000001",
    brand: "Hyundai",
    model: "HB20",
    transmission: "Automático",
    price: 45900,
  };
  const richHb20: ChatVehicleRecord = {
    ...prisma,
    id: "chb20caro00000000000001",
    brand: "Hyundai",
    model: "HB20",
    transmission: "Automático",
    price: 89900,
  };
  const picked = selectChatVehicles(
    "Hyundai HB20 Comfort 2015 · 110.000 km · R$ 45.900",
    "hb20 automatico baratinho",
    [biz, prisma, compass, cheapHb20, richHb20],
  );
  assert.deepEqual(
    picked.map((vehicle) => vehicle.id),
    [cheapHb20.id],
  );
  assert.match(
    chatStockExploreHref(
      "hb20 automatico baratinho",
      [biz, prisma, compass, cheapHb20, richHb20],
      0,
    ) ?? "",
    /maxPrice=45900/,
  );
  assert.match(
    chatStockExploreHref(
      "hb20 automatico baratinho",
      [biz, prisma, compass, cheapHb20, richHb20],
      1,
    ) ?? "",
    /maxPrice=45900/,
  );
});

test("financiamento sem carro citado não inventa anúncio", () => {
  const matched = matchVehiclesInReply(
    "A gente financia em até 60x. Parcela no WhatsApp.",
    [biz, compass],
  );
  assert.equal(matched.length, 0);
});

test("com cards, a comparação e o consumo típico ficam na bolha", () => {
  const palio: ChatVehicleRecord = {
    id: "cpaliogaragem000000000001",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    yearModel: 2016,
    km: 156400,
    price: 47900,
    color: "Branca",
    transmission: "Manual",
    fuel: "Flex",
    engine: "1.8 16V",
    category: "carro",
  };
  const hb20: ChatVehicleRecord = {
    id: "chb20garagem000000000001",
    brand: "Hyundai",
    model: "HB20",
    version: "Comfort 1.0",
    yearModel: 2015,
    km: 127000,
    price: 55900,
    color: "Prata",
    transmission: "Automático",
    fuel: "Flex",
    engine: "1.0",
    category: "carro",
  };
  const leftover = `Até R$ 70.000 estes cabem no orçamento.
Fiat Palio Weekend Adventure 1.8 Flex 16V 2016 · 156.400 km · R$ 47.900
Chevrolet Prisma Sed. Joy/LS 1.0 2019 · 152.000 km · R$ 52.900
Hyundai HB20 Comfort 1.0 2015 · 127.000 km · R$ 55.900
Entre esses, o Palio Weekend é o mais em conta (R$ 47.900). O HB20 tem menos km (127 mil) e é o automático da lista — mais conforto no trânsito. No consumo, faixa típica de catálogo: Prisma e HB20 1.0 ~11–14 km/l na cidade (gasolina); o Palio 1.8 ~8–11 km/l. Nenhum desses usados foi medido na loja.`;
  const cards = [
    toChatVehicleCard(palio),
    toChatVehicleCard(prisma),
    toChatVehicleCard(hb20),
  ];
  const polished = polishChatReplyWithCards(leftover, cards);
  assert.match(polished, /70\.000/);
  assert.match(polished, /mais em conta/);
  assert.match(polished, /conforto/);
  assert.match(polished, /consumo/);
  assert.match(polished, /11–14/);
  assert.match(polished, /foi medido na loja/i);
  assert.doesNotMatch(polished, /156\.400 km · R\$/);
  assert.doesNotMatch(polished, /qual desses/i);
  assert.equal(
    looksLikeLooseVehicleTitle("Hyundai HB20 é o automático da lista"),
    false,
  );
  assert.equal(looksLikeLooseVehicleTitle("Mitsubishi LANCER 2.0"), true);
});

test("comparação com o nome completo do card não some da bolha", () => {
  const palio: ChatVehicleRecord = {
    id: "cpaliogaragem000000000002",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    yearModel: 2016,
    km: 156400,
    price: 47900,
    color: "Branca",
    transmission: "Manual",
    fuel: "Flex",
    engine: "1.8 16V",
    category: "carro",
  };
  const hb20: ChatVehicleRecord = {
    id: "chb20garagem000000000002",
    brand: "Hyundai",
    model: "HB20",
    version: "Premium Automatico 1.6",
    yearModel: 2015,
    km: 127000,
    price: 55900,
    color: "Branco",
    transmission: "Automático",
    fuel: "Flex",
    engine: "1.6",
    category: "carro",
  };
  const leftover = `Até R$ 70.000 eu começaria por estes:
Entre esses, o Fiat Palio Weekend é o mais em conta (R$ 47.900). O Hyundai HB20 tem menos km (127 mil km). O Hyundai HB20 é automático — mais conforto no trânsito.

No consumo, faixa típica de catálogo: Chevrolet Prisma 1.0 flex ~11–14 km/l cidade (gasolina); Fiat Palio Weekend 1.8 ~8–11 km/l. Nenhum desses usados foi medido na loja.`;
  const cards = [
    toChatVehicleCard(palio),
    toChatVehicleCard(prisma),
    toChatVehicleCard(hb20),
  ];
  const polished = polishChatReplyWithCards(leftover, cards);
  assert.match(polished, /70\.000/);
  assert.match(polished, /mais em conta/);
  assert.match(polished, /Prisma/);
  assert.match(polished, /11–14/);
  assert.match(polished, /foi medido na loja/);
  assert.match(polished, /\n\n/);
  assert.doesNotMatch(polished, /156\.400 km · R\$/);
});

test("desambiguação prioriza unidade ativa quando existem dois modelos iguais no estoque", () => {
  const hb20_2021: ChatVehicleRecord = {
    id: "chb20_2021_evolution",
    brand: "Hyundai",
    model: "HB20",
    version: "Evolution 1.0",
    yearModel: 2021,
    km: 54000,
    price: 64900,
    color: "Prata",
    transmission: "Manual",
    fuel: "Flex",
    category: "carro",
  };
  const hb20_2015: ChatVehicleRecord = {
    id: "chb20_2015_premium",
    brand: "Hyundai",
    model: "HB20",
    version: "Premium 1.6",
    yearModel: 2015,
    km: 110000,
    price: 55900,
    color: "Branco",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
  };
  const stock = [hb20_2015, hb20_2021];

  const pickedDefault = selectChatVehicles(
    "Achei o Hyundai HB20 no estoque pra você.",
    "Tenho interesse no Hyundai HB20",
    stock,
    1,
  );
  assert.equal(pickedDefault[0]?.id, hb20_2015.id);

  const pickedActive = selectChatVehicles(
    "Achei o Hyundai HB20 no estoque pra você.",
    "Tenho interesse no Hyundai HB20",
    stock,
    1,
    hb20_2021.id,
  );
  assert.equal(pickedActive[0]?.id, hb20_2021.id);
  assert.equal(pickedActive[0]?.yearModel, 2021);
  assert.equal(pickedActive[0]?.price, 64900);
});
