import assert from "node:assert/strict";
import { test } from "node:test";
import { runChatTurn } from "./chat-turn";
import type { ChatVehicleRecord } from "./chat-stock";

const car: ChatVehicleRecord = {
  id: "c-civic-local",
  brand: "Honda",
  model: "Civic",
  version: "LXR 2.0 FlexOne",
  yearModel: 2015,
  km: 106000,
  price: 74900,
  color: "Azul",
  transmission: "Automático",
  fuel: "Flex",
  category: "carro",
};

test("orçamento e saudação direta respondem sem esperar o modelo; usam dados atuais", async () => {
  for (const mensagem of [
    "Oi",
    "Carros até 80 mil?",
    "Automático até 80 mil?",
  ]) {
    let calls = 0;
    const result = await runChatTurn({
      mensagem,
      historico: [],
      stock: [car],
      generate: async () => {
        calls++;
        throw new Error("não deveria consultar o modelo");
      },
    });
    assert.equal(calls, 0);
    assert.equal(result.leadCreated, false);
    if (mensagem !== "Oi") {
      assert.deepEqual(
        result.vehicles.map((v) => v.id),
        [car.id],
      );
      assert.equal(result.vehicles[0].price, 74900);
      assert.match(result.reply, /74\.900/);
    }
  }
});

test("contato com nome e telefone continua indo para registro de lead; não cai na consulta local", async () => {
  let created = 0;
  const result = await runChatTurn({
    mensagem: "Quero o Civic. Meu nome é Ana Souza, telefone 27988887777",
    historico: [],
    stock: [car],
    generate: async () => ({
      text: "",
      functionCall: {
        name: "criar_lead",
        args: {
          nome: "Ana Souza",
          telefone: "27988887777",
          mensagem: "Interesse Civic",
        },
      },
    }),
    createLead: async () => {
      created++;
      return { id: "local-lead" };
    },
    confirm: async () => "Seu contato foi registrado.",
  });
  assert.equal(created, 1);
  assert.equal(result.leadCreated, true);
});

test("turno cancelado não chama o modelo nem grava contato", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    runChatTurn({
      mensagem: "Civic",
      historico: [],
      stock: [car],
      signal: controller.signal,
      generate: async () => {
        calls++;
        return { text: "", functionCall: null };
      },
    }),
  );
  assert.equal(calls, 0);
});
