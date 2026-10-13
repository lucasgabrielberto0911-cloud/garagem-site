import { textoVisivelChat } from "./chat-test-text";
import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import { pickComparedModelVehicles, scopeChatMessage, searchChatInventory, type ChatVehicleRecord } from "./chat-stock";
import type { ChatTurn } from "./chat-gemini";

const unit = (id: string, model: string, yearModel: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, model, yearModel, brand: "Honda", version: null, price: 80000, km: 60000, transmission: "Automático", fuel: "Flex", color: "Prata", category: "carro", ...extra,
});
const noModel = async () => ({ text: "[LLM]", functionCall: null });
const ask = (mensagem: string, stock: ChatVehicleRecord[], historico: ChatTurn[] = []) => runChatTurn({ mensagem, stock, historico, readIntent: async () => null, generate: noModel });

test("Civic 2020 ou 2015 compara as duas unidades, inclusive após busca incompatível", async () => {
  const stock = [
    unit("civic-2020-explicito", "Civic", 2020, { version: "EXL 2.0", engine: "2.0", price: 125000, km: 65000 }),
    unit("civic-2015-explicito", "Civic", 2015, { version: "LXR 2.0", engine: "2.0", price: 80000, km: 100000 }),
    unit("kicks-explicito", "Kicks", 2019, { brand: "Nissan", version: "SL 1.6", engine: "1.6" }),
  ];
  for (const mensagem of ["civic 2020 ou civic 2015", "civic 2020 ou 2015?"]) {
    assert.deepEqual(pickComparedModelVehicles(stock, mensagem).map(vehicle => vehicle.id), ["civic-2020-explicito", "civic-2015-explicito"]);
    for (const historyText of [null, "quero um suv", "quero manual até 40 mil", "quero suv automático até 60 mil"]) {
      const historico: ChatTurn[] = historyText ? [{ role: "user", content: historyText }] : [];
      const result = await ask(mensagem, stock, historico);
      assert.equal(result.meta?.policy, "compare", `${historyText}: ${result.reply}`);
      assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), ["civic-2020-explicito", "civic-2015-explicito"]);
      assert.match(textoVisivelChat(result.reply), /^Os dois são ótimas escolhas/);
      assert.match(textoVisivelChat(result.reply), /• (?:[^\n]* )?Civic 2020 —/);
      assert.match(textoVisivelChat(result.reply), /• (?:[^\n]* )?Civic 2015 —/);
      assert.equal(result.reply.split("\n").length, 5);
      assert.match(result.reply.trim(), /\?$/);
      assert.doesNotMatch(textoVisivelChat(result.reply), /Não achei|leva vantagem|ganha/);
    }
  }
});

test("modelos atuais ignoram filtros herdados; critérios incompatíveis mostram unidades reais", async () => {
  const stock = [
    unit("city-sem-heranca", "City", 2018, { version: "EXL 1.5", price: 75000 }),
    unit("gol-sem-heranca", "Gol", 2012, { brand: "Volkswagen", version: "Trend 1.0", transmission: "Manual", price: 35000 }),
  ];
  const historico: ChatTurn[] = [{ role: "user", content: "quero SUV manual até 40 mil" }];
  for (const mensagem of ["mostra o City", "quero City", "tem City?"]) {
    assert.equal(scopeChatMessage(mensagem, historico, stock), mensagem);
    const result = await ask(mensagem, stock, historico);
    assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), ["city-sem-heranca"]);
    assert.doesNotMatch(textoVisivelChat(result.reply), /Não achei|não temos|não está/);
    assert.doesNotMatch(textoVisivelChat(result.reply), /\[LLM\]/);
    assert.equal(result.meta?.policy, mensagem.startsWith("tem") ? "availability" : "inventory-search");
  }
  for (const mensagem of ["mostra City manual", "quero City até 40 mil", "quero um SUV City", "mostra City ano 2025"]) {
    const result = await ask(mensagem, stock);
    assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), ["city-sem-heranca"], mensagem);
    assert.match(textoVisivelChat(result.reply), /City/);
    assert.doesNotMatch(textoVisivelChat(result.reply), /Não achei|não temos|não está/);
    assert.match(textoVisivelChat(result.reply), /Automático/);
  }
  // O cliente ainda pode refinar uma busca sem escrever um novo modelo.
  assert.match(scopeChatMessage("menos km", historico, stock), /suv.*carro|suv/i);
});

test("abertura da busca usa SUVs, sedãs, hatches e picapes", async () => {
  const stock = [
    unit("tipo-hrv", "HR-V", 2016),
    unit("tipo-city", "City", 2018),
    unit("tipo-mobi", "Mobi", 2024, { brand: "Fiat", transmission: "Manual" }),
    unit("tipo-hilux", "Hilux", 2020, { brand: "Toyota" }),
  ];
  for (const [mensagem, label, id] of [
    ["quero um suv", "SUVs", "tipo-hrv"],
    ["quero um sedan", "sedãs", "tipo-city"],
    ["quero um hatch", "hatches", "tipo-mobi"],
    ["quero uma picape", "picapes", "tipo-hilux"],
    ["quero uma picape automática", "picapes automáticas", "tipo-hilux"],
  ]) {
    assert.ok(searchChatInventory(mensagem!, stock)?.reply.startsWith(`Olha o que tenho de ${label}`));
    const result = await ask(mensagem!, stock);
    assert.ok(result.reply.startsWith(`Olha o que tenho de ${label}`), result.reply);
    assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), [id]);
  }
});
