import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import { matchChatSoldVehicle, similarToChatSoldVehicle, type ChatSoldVehicle } from "./chat-sold";
import { CHAT_SOLD_VEHICLE_SELECT, loadChatSoldStock } from "./chat-stock-cache";
import { prisma } from "./prisma";
import { chatWhatsAppCta, displayChatText, resolveChatWhatsAppVehicle } from "./chat-text";
import { chatCityReply, type ChatVehicleRecord } from "./chat-stock";

const sold: ChatSoldVehicle[] = [
  { id: "vendido-pulse", brand: "Fiat", model: "Pulse", version: "Audace 1.0 Turbo", yearModel: 2022, category: "carro", transmission: "Automático" },
  { id: "vendido-altis", brand: "Toyota", model: "Corolla", version: "Altis 2.0", yearModel: 2020, category: "carro", transmission: "Automático" },
  { id: "vendido-grand-siena", brand: "Fiat", model: "Grand Siena", version: "Attractive 1.4 EVO 8V Flex", yearModel: 2014, category: "carro", transmission: "Manual" },
];
const unit = (id: string, model: string, yearModel: number, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, model, yearModel, price, brand: "Honda", version: null, km: 65000, transmission: "Automático", fuel: "Flex", color: "Prata", category: "carro", ...extra,
});
const stock = [unit("similar-civic", "Civic", 2020, 92000), unit("similar-city", "City", 2019, 69000), unit("similar-hrv", "HR-V", 2016, 72000), unit("similar-kicks", "Kicks", 2019, 80000), unit("similar-nivus", "Nivus", 2021, 89000), unit("fora-moto", "BIZ", 2023, 14000, { category: "moto" })];
const noModel = async () => { throw new Error("Vendido conhecido não deve chamar o modelo"); };

test("Pulse vendido informa a venda e oferece dois SUVs disponíveis, com aviso correto", async () => {
  const result = await runChatTurn({ mensagem: "tem o Pulse?", historico: [], stock, soldStock: sold, readIntent: async () => null, generate: noModel });
  assert.match(result.reply, /Pulse .*já foi vendido/);
  assert.doesNotMatch(result.reply, /não está na lista|R\$/);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), ["similar-nivus", "similar-kicks"]);
  const cta = chatWhatsAppCta(result.reply, resolveChatWhatsAppVehicle(null, result.vehicles), { userText: "tem o Pulse?" });
  assert.equal(cta?.label, "Avisar quando chegar");
  assert.match(decodeURIComponent(cta?.href ?? ""), /Pulse/);
  assert.doesNotMatch(decodeURIComponent(cta?.href ?? ""), /R\$|Nivus|Kicks/);
});

test("Corolla Altis vendido não se confunde com Corolla GLi disponível", async () => {
  const available = [...stock, unit("corolla-gli", "Corolla", 2020, 95000, { brand: "Toyota", version: "GLi 2.0" })];
  assert.equal(matchChatSoldVehicle("tem Corolla?", available, sold), undefined);
  assert.equal(matchChatSoldVehicle("tem Corolla GLi?", available, sold), undefined);
  const result = await runChatTurn({ mensagem: "e o Corolla Altis?", historico: [], stock: available, soldStock: sold, readIntent: async () => null, generate: noModel });
  assert.match(result.reply, /Corolla Altis .*já foi vendido/);
  assert.equal(result.vehicles.length, 2);
  assert.equal(result.vehicles[0]?.id, "similar-civic");
  assert.ok(result.vehicles.every(vehicle => !vehicle.id.startsWith("vendido")));
});

test("ano específico, modelo nunca visto, unidade vendida em foco e troca do cliente", async () => {
  assert.equal(matchChatSoldVehicle("tem Pulse 2018?", stock, sold), undefined);
  assert.equal(matchChatSoldVehicle("tem Corolla XEi?", stock, sold), undefined);
  assert.equal(matchChatSoldVehicle("tem Corolla Cross?", stock, sold), undefined);
  assert.equal(matchChatSoldVehicle("tem Tesla?", stock, sold, "vendido-pulse"), undefined);
  assert.equal(matchChatSoldVehicle("manda fotos do Tesla", stock, sold, "vendido-pulse"), undefined);
  assert.equal(matchChatSoldVehicle("qual preço?", stock, sold, "vendido-pulse")?.id, "vendido-pulse");
  assert.equal(matchChatSoldVehicle("tem vídeo dele?", stock, sold, "vendido-pulse")?.id, "vendido-pulse");
  const result = await runChatTurn({ mensagem: "tem o Onix?", historico: [], stock, soldStock: sold, readIntent: async () => null, generate: noModel });
  assert.doesNotMatch(result.reply, /vendido/);
  assert.equal(result.meta?.policy, "waitlist");
  const trade = await runChatTurn({ mensagem: "aceita meu Pulse na troca?", historico: [], stock, soldStock: sold, readIntent: async () => null, generate: noModel });
  assert.doesNotMatch(trade.reply, /já foi vendido/);
});

test("parecidos respeitam categoria e orçamento, sem precisar do preço antigo", () => {
  assert.deepEqual(similarToChatSoldVehicle(sold[0]!, stock, "até 75 mil").map(vehicle => vehicle.id), ["similar-hrv", "similar-city"]);
  assert.equal(similarToChatSoldVehicle(sold[0]!, stock, "até 10 mil").length, 0);
});

test("consulta de vendidos seleciona só identidade pública mínima, sem preço ou cidade", async () => {
  assert.deepEqual(Object.keys(CHAT_SOLD_VEHICLE_SELECT).sort(), ["brand", "category", "id", "model", "transmission", "version", "yearModel"]);
  const original = prisma.vehicle.findMany;
  try {
    prisma.vehicle.findMany = (async (query: unknown) => {
      assert.deepEqual(query, { where: { status: "vendido" }, select: CHAT_SOLD_VEHICLE_SELECT, orderBy: { id: "asc" } });
      return sold;
    }) as typeof original;
    assert.deepEqual(await loadChatSoldStock(), sold);
  } finally {
    prisma.vehicle.findMany = original;
  }
});

test("Grande Vitória, carro grande e porta-malas grande não citam Grand Siena vendido; Grand Siena ainda casa", async () => {
  assert.equal(
    displayChatText(chatCityReply("Vocês atendem em Linhares e Grande Vitória?")),
    "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp.",
  );

  for (const question of [
    "Vocês atendem em Linhares e Grande Vitória?",
    "Vocês atendem na Grande Vitória?",
    "Atendem Aracruz?",
  ]) {
    assert.equal(matchChatSoldVehicle(question, stock, sold), undefined, question);
    const cityTurn = await runChatTurn({
      mensagem: question,
      historico: [],
      stock,
      soldStock: sold,
      readIntent: async () => null,
      generate: noModel,
    });
    assert.equal(cityTurn.meta?.policy, "city", question);
    assert.equal(cityTurn.vehicles.length, 0, question);
    assert.doesNotMatch(cityTurn.reply, /Grand Siena|já foi vendido|loja digital|loja física|pontos de venda|atendimento com hora marcada/i, question);
    assert.match(
      displayChatText(cityTurn.reply),
      /^Atendemos Linhares, Aracruz e Grande Vitória\. Combinamos o atendimento pelo WhatsApp\./,
      question,
    );
  }

  for (const search of ["carro grande", "porta-malas grande", "tem carro grande?", "tem carro com porta-malas grande?"]) {
    assert.equal(matchChatSoldVehicle(search, stock, sold), undefined, search);
    const result = await runChatTurn({
      mensagem: search,
      historico: [],
      stock,
      soldStock: sold,
      readIntent: async () => null,
      generate: noModel,
    });
    assert.doesNotMatch(result.reply, /Grand Siena|já foi vendido|não está na lista/i, search);
    assert.ok(result.vehicles.length > 0, search);
    assert.ok(result.vehicles.every((vehicle) => !vehicle.id.startsWith("vendido")), search);
  }

  assert.equal(matchChatSoldVehicle("Grand Siena", stock, sold)?.id, "vendido-grand-siena");
  assert.equal(matchChatSoldVehicle("tem o Grand Siena?", stock, sold)?.id, "vendido-grand-siena");
  const grandSienaTurn = await runChatTurn({
    mensagem: "Grand Siena",
    historico: [],
    stock,
    soldStock: sold,
    readIntent: async () => null,
    generate: noModel,
  });
  assert.equal(grandSienaTurn.meta?.policy, "sold");
  assert.match(grandSienaTurn.reply, /Grand Siena .*já foi vendido/);
  assert.doesNotMatch(grandSienaTurn.reply, /R\$/);
});

test("modelo vendido citado com cidade informa a venda, não a área de atendimento", async () => {
  for (const question of ["tem o Grand Siena em Vitória?", "Grand Siena, atendem Aracruz?"]) {
    assert.equal(matchChatSoldVehicle(question, stock, sold)?.id, "vendido-grand-siena", question);
    const result = await runChatTurn({
      mensagem: question,
      historico: [],
      stock,
      soldStock: sold,
      readIntent: async () => null,
      generate: noModel,
    });
    assert.equal(result.meta?.policy, "sold", question);
    assert.match(result.reply, /Grand Siena .*já foi vendido/, question);
    assert.doesNotMatch(result.reply, /Atendemos Linhares/, question);
  }
});
