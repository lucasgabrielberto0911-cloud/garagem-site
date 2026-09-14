import assert from "node:assert/strict";
import { test } from "node:test";
import { selectChatVehicles } from "./chat-cards";
import {
  asksAboutAvailability,
  asksAboutKm,
  asksToCompareModels,
  equipmentReplyLooksBroken,
  formatAvailabilityReply,
  formatFocusedEquipmentReply,
  formatFocusedKmReply,
  pickComparedModelVehicles,
  type ChatVehicleRecord,
} from "./chat-stock";

const hb20: ChatVehicleRecord = {
  id: "c-hb20-facts",
  brand: "Hyundai",
  model: "HB20",
  version: "evolution 1.0",
  yearModel: 2022,
  km: 68450,
  price: 64900,
  color: "Prata",
  transmission: "Manual",
  fuel: "Flex",
  category: "carro",
  accessories: ["Ar-condicionado", "Direção hidráulica", "Vidros elétricos"],
};

const onix: ChatVehicleRecord = {
  id: "c-onix-facts",
  brand: "Chevrolet",
  model: "Onix",
  version: "LT 1.0",
  yearModel: 2021,
  km: 41000,
  price: 59900,
  color: "Branco",
  transmission: "Automático",
  fuel: "Flex",
  category: "carro",
  accessories: ["Ar-condicionado"],
};

test("quantos km responde a frase completa do hodômetro", () => {
  assert.equal(asksAboutKm("quantos km tem o HB20?"), true);
  const reply = formatFocusedKmReply(hb20);
  assert.match(reply, /68 mil km/);
  assert.match(reply, /hodômetro/);
  assert.match(reply, /[.!?]$/);
});

test("equipamento cortado em direção é tratado como frase quebrada", () => {
  assert.equal(equipmentReplyLooksBroken("O Fox tem ar-condicionado, direção"), true);
  const complete = formatFocusedEquipmentReply(hb20, "quais os opcionais?");
  assert.match(complete, /Direção hidráulica/);
  assert.doesNotMatch(complete, /direção$/);
  assert.match(complete, /[.!?]$/);
});

test("Esse carro ainda tem? reconhece disponibilidade", () => {
  assert.equal(asksAboutAvailability("Esse carro ainda tem?"), true);
  assert.equal(asksAboutAvailability("já vendeu?"), true);
  assert.equal(asksAboutAvailability("está disponível amanhã?"), false);
  assert.match(formatAvailabilityReply(hb20), /ainda está no estoque/);
  assert.match(formatAvailabilityReply(null, { sold: true }), /já saiu do estoque/);
});

test("HB20 vs Onix escolhe uma unidade de cada modelo", () => {
  assert.equal(asksToCompareModels("HB20 vs Onix"), true);
  assert.equal(asksToCompareModels("HB20 ou Onix?"), true);
  const picks = pickComparedModelVehicles([hb20, onix], "HB20 vs Onix");
  assert.equal(picks.length, 2);
  assert.deepEqual(
    picks.map((vehicle) => vehicle.model).sort(),
    ["HB20", "Onix"],
  );
  const cards = selectChatVehicles(
    "comparando os dois",
    "HB20 vs Onix",
    [hb20, onix],
  );
  assert.equal(cards.length, 2);
  assert.ok(cards.every((card) => card.category === "carro"));
});
