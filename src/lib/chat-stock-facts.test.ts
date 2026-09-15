import assert from "node:assert/strict";
import { test } from "node:test";
import { selectChatVehicles } from "./chat-cards";
import {
  asksAboutAvailability,
  asksAboutKm,
  asksAboutTransmissionCompare,
  asksToCompareModels,
  chatPolicyShortcut,
  emptyFilterReply,
  equipmentReplyLooksBroken,
  filterStockByTransmission,
  formatAvailabilityReply,
  formatFocusedEquipmentReply,
  formatFocusedKmReply,
  formatTransmissionCompareReply,
  formatVehicleLine,
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
  assert.equal(asksAboutKm("Qual o preço e a km?"), false);
  const reply = formatFocusedKmReply(hb20);
  assert.match(reply, /68 mil km/);
  assert.match(reply, /hodômetro/);
  assert.match(reply, /[.!?]$/);
});

test("equipamento cortado em direção é tratado como frase quebrada", () => {
  assert.equal(equipmentReplyLooksBroken("O Fox tem ar-condicionado, direção"), true);
  const complete = formatFocusedEquipmentReply(hb20, "quais os opcionais?");
  assert.match(complete, /Direção hidráulica/);
  assert.match(complete, /na ficha tem/);
  assert.doesNotMatch(complete, /direção$/);
});

test("Esse carro ainda tem? reconhece disponibilidade", () => {
  assert.equal(asksAboutAvailability("Esse carro ainda tem?"), true);
  assert.equal(asksAboutAvailability("já vendeu?"), true);
  assert.equal(asksAboutAvailability("está disponível?"), true);
  assert.equal(asksAboutAvailability("está disponível amanhã?"), false);
  assert.match(formatAvailabilityReply(hb20), /ainda está no estoque/);
  assert.match(formatAvailabilityReply(null, { sold: true }), /já saiu do estoque/);
});

test("linha do estoque não repete 1.6 quando o modelo já tem", () => {
  const fox16: ChatVehicleRecord = {
    ...hb20,
    id: "c-fox-line",
    brand: "Volkswagen",
    model: "Fox 1.6",
    version: "Trend 1.6",
    yearModel: 2014,
    km: 98000,
    price: 38900,
  };
  const line = formatVehicleLine(fox16);
  assert.match(line, /Volkswagen Fox 1\.6 Trend 2014/);
  assert.doesNotMatch(line, /1\.6 1\.6|Trend 1\.6 2014/);
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

test("filtro automático vazio não cai no estoque inteiro — waitlist + similar", () => {
  const autos = filterStockByTransmission([hb20], "Tem automático?");
  assert.equal(autos.length, 0);
  const reply = emptyFilterReply("Tem automático até 40 mil?", [hb20, onix]);
  assert.match(reply ?? "", /não tem anúncio agora/i);
  assert.match(reply ?? "", /WhatsApp|wa\.me/);
  assert.match(decodeURIComponent(reply ?? ""), /automático até R\$\s*40\.000/i);
  assert.doesNotMatch(reply ?? "", /·\s*R\$/);
});

test("diferença automático vs manual compara o estoque atual", () => {
  assert.equal(
    asksAboutTransmissionCompare("Qual a diferença do automático e do manual no estoque?"),
    true,
  );
  assert.equal(chatPolicyShortcut("Qual a diferença do automático vs manual?"), "gear");
  const reply = formatTransmissionCompareReply([hb20, onix], "automático vs manual");
  assert.match(reply, /trânsito|marcha/);
  assert.match(reply, /HB20/);
  assert.match(reply, /Onix/);
  assert.doesNotMatch(reply, /fipe/i);
});
