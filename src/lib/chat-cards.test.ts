import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isChatVehicleListingLine,
  matchVehiclesInReply,
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
  assert.equal(card.photo, "https://cdn.example/biz-card.webp");
  assert.match(card.href, /^\/estoque\/honda-biz-125/);
  assert.equal(card.href.includes(biz.id), true);
});

test("financiamento sem carro citado não inventa anúncio", () => {
  const matched = matchVehiclesInReply(
    "A gente financia em até 60x. Parcela no WhatsApp.",
    [biz, compass],
  );
  assert.equal(matched.length, 0);
});
