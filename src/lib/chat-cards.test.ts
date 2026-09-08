import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatStockExploreHref,
  chatStockExploreLabel,
  isBareBudgetQuery,
  isChatVehicleListingLine,
  matchVehiclesInReply,
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
  const picked = selectChatVehicles(
    "Honda BIZ 125 EX 125 FLEX 2023 · 22.000 km · R$ 17.900",
    "Quais carros até 70 mil?",
    [biz, prisma, compass],
  );
  assert.deepEqual(
    picked.map((vehicle) => vehicle.id),
    [biz.id, prisma.id],
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
    [biz.id, extra.id, prisma.id],
  );
  assert.equal(
    picked.some((vehicle) => vehicle.id === compass.id),
    false,
  );
  assert.equal(
    chatStockExploreHref("Quais carros até 70 mil?", [biz, prisma, compass, extra], 3),
    null,
  );
  assert.equal(
    chatStockExploreHref(
      "Quais carros até 70 mil?",
      [biz, prisma, compass, extra, { ...extra, id: "cextra2garagem0000000001", price: 25000 }],
      3,
    ),
    "/estoque?maxPrice=70000",
  );
  assert.match(chatStockExploreLabel("/estoque?maxPrice=70000"), /70\.000/);
});

test("pedido de modelo na faixa mantém o carro citado na frente", () => {
  const picked = selectChatVehicles(
    "Chevrolet Prisma Sed. Joy/LS 1.0 8V FlexPower 4p 2019 · 152.000 km · R$ 52.900",
    "Tem Prisma até 70 mil?",
    [biz, prisma, compass],
  );
  assert.equal(picked[0]?.id, prisma.id);
  assert.equal(picked[1]?.id, biz.id);
});

test("financiamento sem carro citado não inventa anúncio", () => {
  const matched = matchVehiclesInReply(
    "A gente financia em até 60x. Parcela no WhatsApp.",
    [biz, compass],
  );
  assert.equal(matched.length, 0);
});
