import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import { matchFocusedVehicle, matchInterestVehicle, pickComparedModelVehicles, type ChatVehicleRecord } from "./chat-stock";

const unit = (id: string, brand: string, model: string, yearModel: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, brand, model, yearModel, version: null, price: 80000, km: 60000, transmission: "Automático", fuel: "Flex", color: "Prata", category: "carro", ...extra,
});
const noModel = async () => ({ text: "[LLM]", functionCall: null });

const stock = [
  unit("civic-consignado", "Honda", "Civic", 2020, { version: "EXL 2.0", consigned: true, price: 125000 }),
  unit("civic-proprio", "Honda", "Civic", 2015, { version: "LXR 2.0" }),
  unit("duster-consignado", "Renault", "Duster", 2019, { version: "Dynamique", consigned: true }),
  unit("duster-proprio", "Renault", "Duster", 2018, { version: "Expression" }),
  unit("onix", "Chevrolet", "Onix", 2020, { version: "LT" }),
];

test("só o nome do modelo prefere a unidade não consignada", () => {
  assert.equal(matchFocusedVehicle("civic", stock)?.id, "civic-proprio");
  assert.equal(matchInterestVehicle("duster", stock, 1)?.id, "duster-proprio");
  assert.equal(matchFocusedVehicle("tem civic?", [...stock].reverse())?.id, "civic-proprio");
});

test("versão ou ano citados continuam achando a unidade consignada", () => {
  assert.equal(matchFocusedVehicle("civic exl 2020", stock)?.id, "civic-consignado");
});

test("sem alternativa própria, o consignado ainda é encontrado", () => {
  assert.equal(matchFocusedVehicle("civic", [stock[0]!, stock[4]!])?.id, "civic-consignado");
});

test("comparação sem versão escolhe a unidade própria de cada modelo", () => {
  assert.deepEqual(pickComparedModelVehicles(stock, "civic ou duster").map(v => v.id), ["civic-proprio", "duster-proprio"]);
});

test("pergunta só com o modelo não vaza o campo consignado na resposta", async () => {
  const result = await runChatTurn({ mensagem: "civic", stock, historico: [], readIntent: async () => null, generate: noModel });
  assert.doesNotMatch(result.reply, /consign/i);
  if (result.vehicles.length) assert.equal(result.vehicles[0]!.id, "civic-proprio");
});
