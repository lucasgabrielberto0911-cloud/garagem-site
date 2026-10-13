import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import type { ChatVehicleRecord } from "./chat-stock";
import type { ChatSoldVehicle } from "./chat-sold";

const unit = (id: string, model: string, yearModel: number, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, model, yearModel, price, brand: "Honda", version: null, km: 50000, transmission: "Automático", fuel: "Flex", color: "Prata", category: "carro", ...extra,
});
const stock = [
  unit("lote-city", "City", 2018, 65000, { version: "EXL 1.5 CVT", engine: "1.5" }),
  unit("lote-kicks", "Kicks", 2019, 80000, { brand: "Nissan", version: "SL 1.6 XTRONIC", engine: "1.6", km: 45000 }),
  unit("lote-hrv", "HR-V", 2016, 75000, { version: "EXL 1.8", engine: "1.8" }),
  unit("lote-mobi", "Mobi", 2024, 58000, { brand: "Fiat", version: "Like 1.0", engine: "1.0", transmission: "Manual" }),
  unit("lote-gol", "Gol", 2012, 35000, { brand: "Volkswagen", version: "Trend 1.0", engine: "1.0", transmission: "Manual" }),
];
const soldStock: ChatSoldVehicle[] = [
  { id: "lote-pulse-vendido", brand: "Fiat", model: "Pulse", version: "Audace", yearModel: 2022, category: "carro", transmission: "Automático" },
  { id: "lote-altis-vendido", brand: "Toyota", model: "Corolla", version: "Altis", yearModel: 2020, category: "carro", transmission: "Automático" },
];

test("bateria de 25 perguntas: comparação, mídia, vendidos, preço, pagamento e typo", async () => {
  const cases: Array<[string, RegExp, Partial<Parameters<typeof runChatTurn>[0]>?]> = [
    ["oi", /estoque|orçamento|modelo/i],
    ["automático", /automático/i],
    ["manual", /manua(?:l|is)/i],
    ["carro até 60 mil", /Gol|Mobi/],
    ["qual o mais barato?", /Gol/],
    ["qual automático mais novo?", /Kicks/],
    ["tem hrv?", /HR-V/],
    ["tem City?", /City/],
    ["Kicks ou HR-V?", /Os dois são ótimas escolhas/],
    ["Kicks ou HR-V, qual você indica?", /Os dois são ótimas escolhas/],
    ["Kicks, HR-V ou City?", /São ótimas escolhas/],
    ["Kicks ou HR-V, qual consome menos?", /km\/l/],
    ["Kicks ou HR-V, qual é mais potente?", /cv/],
    ["Kicks ou HR-V, qual tem mais espaço?", /porta-malas/],
    ["tem o Pulse?", /já foi vendido/],
    ["e o Corolla Altis?", /já foi vendido/],
    ["tem o Onix?", /não está na lista atual/],
    ["tem mais fotos dele?", /mais fotos do City/, { vehicleId: "lote-city" }],
    ["tem vídeo dele?", /um vídeo do City/, { vehicleId: "lote-city" }],
    ["manda mais fotos", /De qual deles: .*City.*Kicks.*HR-V/, { previousVehicleIds: ["lote-city", "lote-kicks", "lote-hrv"] }],
    ["qual o preço do City?", /65\.000/],
    ["aceita troca?", /Aceitamos sim/],
    ["vocês financiam?", /análise de crédito/],
    ["aceita cartão?", /18 vezes/],
    ["qual horário de vocês?", /8h às 23h/],
  ];
  assert.equal(cases.length, 25);
  for (const [mensagem, expected, context] of cases) {
    const result = await runChatTurn({ mensagem, historico: [], stock, soldStock, ...context,
      readIntent: async () => null,
      generate: async () => { throw new Error("A bateria simples deve usar dados e regras locais"); },
    });
    assert.match(result.reply, expected, mensagem);
    assert.doesNotMatch(result.reply, /leva vantagem|Sua Garagem|Fontes:|\[LLM\]/, mensagem);
    assert.ok(result.vehicles.length <= 3, mensagem);
    assert.ok(result.reply.replace(/https?:\/\/\S+/g, "").length < 650, mensagem);
    assert.match(result.reply.trim(), /\?$/, mensagem);
  }
});
