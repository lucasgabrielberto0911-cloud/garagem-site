import { textoVisivelChat } from "./chat-test-text";
import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import { neutralChatComparison, guardChatComparisonWinner } from "./chat-comparison";
import { CHAT_SYSTEM_PROMPT } from "./chat-prompt";
import type { ChatVehicleRecord } from "./chat-stock";

const unit = (id: string, model: string, version: string, yearModel: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, model, version, yearModel, brand: "Honda", km: 80000, price: 75000, transmission: "Automático", fuel: "Flex", color: "Prata", category: "carro", ...extra,
});
const stock = [
  unit("kicks-neutro", "Kicks", "SL 1.6 Flex Start XTRONIC", 2019, { brand: "Nissan", km: 50000, price: 80000, engine: "1.6" }),
  unit("hrv-neutro", "HR-V", "EXL 1.8 Flexone", 2016, { engine: "1.8" }),
  unit("civic-neutro", "Civic", "EXL 2.0 FLEX 16V", 2020, { engine: "2.0", km: 60000, price: 100000 }),
];
const noModel = async () => { throw new Error("Comparação simples não deve chamar o modelo"); };

test("Kicks ou HR-V: abertura neutra, ponto forte de cada ficha e dois cards", async () => {
  const result = await runChatTurn({ mensagem: "Kicks ou HR-V?", historico: [], stock, readIntent: async () => null, generate: noModel });
  assert.match(textoVisivelChat(result.reply), /^Os dois são ótimas escolhas, cada um tem seu ponto forte:/);
  assert.match(textoVisivelChat(result.reply), /• Kicks .*2019 — menos km e mais novo/);
  assert.match(textoVisivelChat(result.reply), /• HR-V .*2016 — mais em conta/);
  assert.doesNotMatch(textoVisivelChat(result.reply), /leva vantagem|ganha|melhor|Quer que|WhatsApp/);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), ["kicks-neutro", "hrv-neutro"]);
  assert.equal(result.reply.split("\n").length, 3);
});

test("indicação, diferença e dados pedidos entre nossos carros continuam neutros", async () => {
  for (const mensagem of ["Kicks ou HR-V, qual você indica?", "qual é melhor, Kicks ou HR-V?", "diferença entre Kicks e HR-V", "Kicks ou HR-V, qual o mais forte?", "Kicks ou HR-V, qual é mais econômico?", "Kicks ou HR-V, qual tem mais espaço?", "Kicks ou HR-V, qual consome menos?"]) {
    const result = await runChatTurn({ mensagem, historico: [], stock, readIntent: async () => null, generate: noModel });
    assert.match(textoVisivelChat(result.reply), /^Os dois são ótimas escolhas/, mensagem);
    assert.equal(result.reply.split("\n").filter(line => line.startsWith("• ")).length, 2, mensagem);
    assert.equal(result.vehicles.length, 2, mensagem);
    assert.doesNotMatch(textoVisivelChat(result.reply), /leva vantagem|ganha|vence|é melhor|mais forte:|mais econômico:/, mensagem);
    if (mensagem.includes("consome")) assert.match(textoVisivelChat(result.reply), /km\/l/);
  }
});

test("três modelos: uma frase, três linhas e três cards, sem herdar orçamento anterior", async () => {
  const result = await runChatTurn({ mensagem: "Kicks, HR-V ou Civic?", historico: [{ role: "user", content: "até 40 mil" }], stock, readIntent: async () => null, generate: noModel });
  assert.equal(result.vehicles.length, 3);
  assert.equal(result.reply.split("\n").length, 4);
  assert.match(textoVisivelChat(result.reply), /^São ótimas escolhas/);
});

test("potência, consumo e espaço usam valores da ficha, sem inferir pela cilindrada", () => {
  assert.match(neutralChatComparison(stock.slice(0, 2), "mais forte"), /\d+ cv/);
  assert.match(neutralChatComparison(stock.slice(0, 2), "consumo"), /km\/l/);
  assert.match(neutralChatComparison(stock.slice(0, 2), "espaço"), /L de porta-malas/);
  assert.doesNotMatch(neutralChatComparison([unit("a", "Modelo A", "", 2020), unit("b", "Modelo B", "", 2021)], "consumo"), /km\/l|gasta menos/);
});

test("prompt e guarda impedem o modelo de declarar vencedor", () => {
  assert.match(CHAT_SYSTEM_PROMPT, /Nunca declare vencedor/);
  for (const phrase of ["O Kicks leva vantagem:", "O HR-V ganha.", "O Civic é melhor.", "O Kicks é a melhor opção.", "O HR-V é superior."]) {
    const safe = guardChatComparisonWinner(`${phrase}\n• Kicks 2019 — menos km\n• HR-V 2016 — mais em conta`, stock);
    assert.doesNotMatch(safe, /leva vantagem|ganha|é melhor|melhor opção|superior/);
    assert.match(safe, /• Kicks/);
  }
  assert.equal(guardChatComparisonWinner("O Civic tem menos km.", stock), "O Civic tem menos km.");
});

test("guarda do turno bloqueia vencedor antes de emitir texto do modelo", async () => {
  let emitted = "";
  const result = await runChatTurn({ mensagem: "Kicks ou HR-V? Meu telefone é (27) 99999-0000", historico: [], stock,
    readIntent: async () => null,
    generate: async () => ({ text: "O Kicks leva vantagem:\n• Kicks 2019 — menos km\n• HR-V 2016 — mais em conta", functionCall: null }),
    onToken: text => { emitted += text; },
  });
  assert.doesNotMatch(textoVisivelChat(result.reply), /leva vantagem/);
  assert.doesNotMatch(emitted, /leva vantagem/);
});
