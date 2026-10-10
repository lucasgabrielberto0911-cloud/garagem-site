import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import { parsePriceLimit } from "./chat-prompt";
import type { ChatVehicleRecord } from "./chat-stock";
import type { ChatTurn } from "./chat-gemini";

// Synthetic local stock: never published as ads or claimed as live availability.
const car = (id: string, model: string, price: number, engine: string, transmission = "Automático"): ChatVehicleRecord => ({ id, brand: "Teste", model, version: `Teste ${engine}`, engine, price, km: 100000, yearModel: 2015, transmission, category: "carro", color: "Preto", fuel: "Flex" });
const stock = [car("hb", "HB20", 49900, "1.6"), car("duster", "Duster", 54900, "2.0"), car("civic", "Civic", 74900, "2.0"), car("hrv", "HR-V", 84900, "1.8"), car("manual", "Manual teste", 45000, "1.0", "Manual")];
const user = (content: string): ChatTurn => ({ role: "user", content });
const comparing = [user("compare o Civic e o Duster")];

const cases = [
  { question: "qual desses vale mais para estrada?", history: [user("automáticos até 60 mil")], ids: ["duster", "hb"], road: true },
  { question: "na verdade agora quero um manual", history: [user("automáticos até 60 mil")], ids: ["manual"] },
  { question: "automático até 59,9 mil", history: [], ids: ["duster", "hb"], budget: 59900 },
  { question: "automático até R$ 54.900,00", history: [], ids: ["duster", "hb"], budget: 54900 },
  { question: "tenho 60 mil para gastar, automático", history: [], ids: ["duster", "hb"], budget: 60000 },
] as const;
for (const scenario of cases) test(`avaliação de escolha: ${scenario.question}`, async () => {
  let generated = 0;
  const streamed: string[] = [];
  const result = await runChatTurn({
    onToken: delta => streamed.push(delta),
    mensagem: scenario.question, historico: [...scenario.history], stock, vehicleId: "hb",
    generate: async () => { generated++; return { text: "Sim — o HB20 é Automático." }; },
  });
  assert.equal(generated, 0);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id).sort(), [...scenario.ids].sort());
  assert.doesNotMatch(result.reply, /Sim.*HB20|verdade manual|é o mais forte|\d+\s*cv/);
  if ("budget" in scenario) assert.ok(result.vehicles.every(vehicle => vehicle.price <= scenario.budget));
  if ("road" in scenario) {
    assert.match(result.reply, /prioriza conforto, consumo ou desempenho/);
    assert.doesNotMatch(result.reply, /Eu levaria|mais seguro|mais confortável|melhor para estrada/i);
  }
});

// Pergunta técnica sobre os carros da conversa: o modelo de linguagem responde com o contexto certo.
const expertCases = [
  { question: "e o consumo desses dois?", reply: "Os dois andam parecido na cidade; o Civic costuma ser um pouco mais econômico na estrada.", ids: ["civic", "duster"] },
  { question: "qual desses é o mais potente?", reply: "O Civic é o mais forte dos dois.", ids: ["civic"] },
  { question: "qual deles é o mais forte?", reply: "Dos dois, o Civic leva em potência.", ids: ["civic"] },
  { question: "entre os dois qual é o mais econômico?", reply: "O Civic costuma gastar menos que o Duster.", ids: ["civic", "duster"] },
] as const;
for (const scenario of expertCases) test(`avaliação de escolha (especialista): ${scenario.question}`, async () => {
  let prompt = "";
  const streamed: string[] = [];
  const result = await runChatTurn({
    onToken: delta => streamed.push(delta),
    mensagem: scenario.question, historico: [...comparing], stock, vehicleId: "hb",
    generate: async ({ systemPrompt }) => { prompt = systemPrompt; return { text: scenario.reply, functionCall: null }; },
  });
  assert.equal(result.meta?.policy, "expert");
  assert.match(prompt, /MODO ESPECIALISTA/);
  assert.match(prompt, /Civic/);
  assert.match(prompt, /Duster/);
  assert.equal(result.reply, scenario.reply);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id).sort(), [...scenario.ids].sort());
  assert.doesNotMatch(result.reply, /No estoque:|Achei \d/);
});

test("orçamento com decimal e separador de milhar não aumenta dez vezes", () => {
  for (const [question, expected] of [["até 59,9 mil", 59900], ["até 59.9k", 59900], ["até R$ 59.900,00", 59900], ["de 50 a 59,9 mil", 59900], ["até 80 mil km", null], ["até 2018", null], ["motor 2.0", null]] as const) assert.equal(parsePriceLimit(question), expected, question);
});
