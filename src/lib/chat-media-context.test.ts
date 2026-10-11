import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import { chatWhatsAppCta, lastShownChatVehicles, lastSingleChatVehicleId, resolveChatRequestVehicleId, resolveChatWhatsAppVehicle } from "./chat-text";
import { resolveChatMediaVehicles } from "./chat-media";
import type { ChatVehicleRecord } from "./chat-stock";
import type { ChatMessage } from "./chat-history";

const stock: ChatVehicleRecord[] = [
  { id: "foto-city", brand: "Honda", model: "City", version: "EXL 1.5", yearModel: 2018, km: 55000, price: 68000, transmission: "Automático", fuel: "Flex", color: "Prata" },
  { id: "foto-onix", brand: "Chevrolet", model: "Onix", version: "LT 1.0", yearModel: 2020, km: 40000, price: 58000, transmission: "Manual", fuel: "Flex", color: "Branco" },
  { id: "foto-civic", brand: "Honda", model: "Civic", version: "EXL 2.0", yearModel: 2020, km: 50000, price: 95000, transmission: "Automático", fuel: "Flex", color: "Preto" },
];
const noModel = async () => { throw new Error("Pedido de mídia não deve chamar o modelo"); };
const ask = (mensagem: string, messages: ChatMessage[] = [], pageVehicleId?: string) => runChatTurn({
  mensagem, stock, historico: messages.map(({ role, content }) => ({ role, content })),
  vehicleId: resolveChatRequestVehicleId({ mensagem, pageVehicleId, lastSingleCardId: lastSingleChatVehicleId(messages), shownCards: lastShownChatVehicles(messages) }),
  previousVehicleIds: lastShownChatVehicles(messages).map(vehicle => vehicle.id),
  readIntent: async () => null, generate: noModel,
});

test("busca de um card seguida por fotos/vídeo mantém o carro e o CTA correto", async () => {
  const first = await ask("tem o City?");
  assert.deepEqual(first.vehicles.map(vehicle => vehicle.id), ["foto-city"]);
  const messages: ChatMessage[] = [{ role: "user", content: "tem o City?" }, { role: "assistant", content: first.reply, vehicles: first.vehicles }];
  for (const mensagem of ["tem mais fotos dele?", "manda mais fotos", "tem vídeo dele?"]) {
    const result = await ask(mensagem, messages);
    assert.equal(result.meta?.policy, "media");
    assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), ["foto-city"]);
    assert.doesNotMatch(result.reply, /Não achei|não está|vendido/);
    const cta = chatWhatsAppCta(result.reply, resolveChatWhatsAppVehicle(null, result.vehicles), { userText: mensagem });
    assert.equal(cta?.label, mensagem.includes("vídeo") ? "Pedir vídeo" : "Pedir mais fotos");
    assert.match(decodeURIComponent(cta?.href ?? ""), /City/);
    assert.doesNotMatch(decodeURIComponent(cta?.href ?? ""), /Onix|Civic|quando chegar/);
  }
});

test("automático seguido por fotos sem foco pergunta pelos dois cards anteriores", async () => {
  const first = await ask("automático");
  assert.equal(first.vehicles.length, 2);
  const messages: ChatMessage[] = [{ role: "user", content: "automático" }, { role: "assistant", content: first.reply, vehicles: first.vehicles }];
  const result = await ask("tem mais fotos dele?", messages);
  assert.equal(result.meta?.policy, "media-ask");
  assert.match(result.reply, /^De qual deles: .*City.*Civic/);
  assert.equal(result.vehicles.length, 0);
  assert.equal(chatWhatsAppCta(result.reply, null, { userText: "tem mais fotos dele?" }), null);
  const chosen = await ask("manda fotos do Civic", [...messages, { role: "user", content: "tem mais fotos dele?" }, { role: "assistant", content: result.reply }]);
  assert.deepEqual(chosen.vehicles.map(vehicle => vehicle.id), ["foto-civic"]);
  const selected = await ask("o Civic", [...messages, { role: "user", content: "tem mais fotos dele?" }, { role: "assistant", content: result.reply }]);
  assert.deepEqual(selected.vehicles.map(vehicle => vehicle.id), ["foto-civic"]);
  assert.equal(chatWhatsAppCta(selected.reply, resolveChatWhatsAppVehicle(null, selected.vehicles), { userText: "o Civic" })?.label, "Pedir mais fotos");
});

test("ficha aberta, modelo explicitamente citado e IDs desconhecidos", async () => {
  const focused = await ask("tem vídeo dele?", [], "foto-onix");
  assert.deepEqual(focused.vehicles.map(vehicle => vehicle.id), ["foto-onix"]);
  const named = await ask("manda mais fotos do City", [], "foto-onix");
  assert.deepEqual(named.vehicles.map(vehicle => vehicle.id), ["foto-city"]);
  assert.deepEqual(resolveChatMediaVehicles("manda fotos", stock, undefined, ["desconhecido", "foto-city", "foto-city"]), [stock[0]]);
  const noFocus = await ask("manda mais fotos");
  assert.equal(noFocus.reply, "De qual carro você quer fotos ou vídeo?");
  assert.equal(noFocus.vehicles.length, 0);
});

test("mídia de modelo com duas unidades pede escolha, sem escolher pela ordem", () => {
  const units = [stock[0]!, { ...stock[0]!, id: "foto-city-2021", yearModel: 2021 }];
  assert.equal(resolveChatMediaVehicles("fotos do City", units).length, 2);
  assert.deepEqual(resolveChatMediaVehicles("fotos do City 2021", units).map(vehicle => vehicle.id), ["foto-city-2021"]);
});
