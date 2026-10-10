import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import type { ChatVehicleRecord } from "@/lib/chat-stock";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord =>
  ({ id, brand, model, version, yearModel, km: 80000, price, color: "Prata", transmission: "Automático", fuel: "Flex", category: "carro", ...extra }) as ChatVehicleRecord;

const stock = [
  car("k", "Nissan", "Kicks", "SL 1.6 Flex Start XTRONIC", 2019, 86900),
  car("h", "Honda", "HR-V", "EXL 1.8 Flexone", 2016, 84900),
  car("g", "Volkswagen", "Gol", "Trend 1.0 Completo", 2012, 32900, {
    transmission: "Manual",
    accessories: ["Central multimídia", "ABS", "Ar-condicionado"],
  }),
  car("m", "Fiat", "Mobi", "Like 1.0 Fire EVO Flex", 2024, 57900, {
    transmission: "Manual",
    accessories: ["Ar-condicionado", "Direção hidráulica", "Vidros elétricos dianteiros com função one-touch e antiesmagamento", "nas 4 portas", "completo"],
  }),
];
const noReading = async () => null;

test("Kicks x HR-V 'qual você indica?' vai ao especialista mesmo com 'até 70 mil' no histórico", async () => {
  let called = false;
  const result = await runChatTurn({
    mensagem: "entre o Kicks e o HR-V, qual você indica?",
    historico: [
      { role: "user", content: "tem automático até 70 mil?" },
      { role: "assistant", content: "Olha o que tenho de carros automáticos, até R$ 70.000." },
    ],
    stock,
    readIntent: noReading,
    generate: async () => {
      called = true;
      return { text: "O Kicks é ótimo pra quem quer economia; o HR-V pra quem quer mais espaço.", functionCall: null };
    },
  });
  assert.equal(called, true, `${result.meta?.policy}: ${result.reply}`);
  assert.notEqual(result.meta?.policy, "inventory-empty");
  assert.match(result.reply, /Kicks/);
});

test("opcional ausente mantém o nome do item e não afirma que tem", async () => {
  const result = await runChatTurn({ mensagem: "esse Mobi tem central multimídia?", historico: [], stock, vehicleId: "m", readIntent: noReading, generate: async () => { throw new Error("não deveria gerar"); } });
  assert.match(result.reply, /não consta central multimídia/);
  assert.doesNotMatch(result.reply, /, dianteiros|nas 4 portas|completo/);
  assert.match(result.reply, /Vidros elétricos dianteiros/);
});

test("'e airbag e ABS, tem?' no carro em tela: ABS consta, airbag não aparece, sem chamar o modelo", async () => {
  const result = await runChatTurn({
    mensagem: "e airbag e ABS, tem?",
    historico: [
      { role: "user", content: "esse Gol tem teto solar?" },
      { role: "assistant", content: "Na ficha desse Gol não consta teto solar." },
    ],
    stock,
    vehicleId: "g",
    readIntent: noReading,
    generate: async () => { throw new Error("não deveria gerar"); },
  });
  assert.equal(result.meta?.policy, "stock-fact");
  assert.match(result.reply, /consta freios ABS/);
  assert.match(result.reply, /Airbags não aparece/i);
  assert.doesNotMatch(result.reply, /tem airbag|com airbag/i);
});
