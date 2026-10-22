import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn, formatChatResult } from "./chat-turn";
import { vehiclePath } from "./vehicle-slug";
import { toChatVehicleCard } from "./chat-cards";
import { applyChatStockFilters, type ChatVehicleRecord } from "./chat-stock";
import type { ChatTurn } from "./chat-gemini";

const base = { color: "Prata", fuel: "Flex", category: "carro" as const, km: 50_000, price: 70_000 };
const v = (
  id: string,
  brand: string,
  model: string,
  version: string,
  yearModel: number,
  transmission: string,
  engine: string,
  extra: Partial<ChatVehicleRecord> = {},
): ChatVehicleRecord => ({
  ...base,
  id,
  brand,
  model,
  version,
  yearModel,
  transmission,
  engine,
  ...extra,
});

const hb16 = v("hb16", "Hyundai", "HB20", "Premium 1.6 Aut", 2015, "Automático", "1.6 Aspirado", {
  km: 127_000,
  price: 56_900,
  locationCity: "Linhares",
  accessories: ["Ar-condicionado", "Direção hidráulica"],
});

const hb10 = v("hb10", "Hyundai", "HB20", "Evolution 1.0", 2022, "Manual", "1.0 Aspirado", {
  km: 40_000,
  price: 69_900,
  accessories: ["Ar-condicionado", "Airbag"],
});

const hb20s = v("hb20s", "Hyundai", "HB20S", "Comfort Plus 1.0 TGDI Aut", 2024, "Automático", "1.0 TGDI", {
  km: 50_000,
  price: 89_900,
  accessories: ["Ar-condicionado", "Câmera de ré"],
});

const kicks = v("kicks", "Nissan", "Kicks", "SL 1.6 CVT", 2019, "Automático", "1.6", {
  price: 89_900,
  accessories: ["Ar-condicionado", "Direção elétrica"],
});

const civic1 = v("civ1", "Honda", "Civic", "LXR 2.0", 2014, "Automático", "2.0", {
  accessories: ["Ar-condicionado", "Bancos de couro"],
});
const civic2 = v("civ2", "Honda", "Civic", "LXR 2.0", 2015, "Automático", "2.0", {
  accessories: ["Ar-condicionado"],
});
const civic3 = v("civ3", "Honda", "Civic", "Sport 2.0", 2017, "Automático", "2.0", {
  accessories: ["Ar-condicionado", "Piloto automático"],
});
const civic4 = v("civ4", "Honda", "Civic", "EXL 2.0", 2020, "Automático", "2.0", {
  accessories: ["Direção elétrica"], // sem ar-condicionado na ficha
});

const stock = [hb16, hb10, hb20s, kicks, civic1, civic2, civic3, civic4];

const user = (content: string): ChatTurn => ({ role: "user", content });
const assistant = (content: string): ChatTurn => ({ role: "assistant", content });

// 1) chat-turn.ts:1457/:1488: filtro de abertura e resposta contra Linhares/cidade/local,
// parcela/taxa/juros/simulador e faixa de preço não dita pelo cliente.
test("Bloqueante 1: descarta abertura e remove frases com Linhares/cidade/local, parcela/taxa/juros/simulador e faixa não dita", async () => {
  const result = await runChatTurn({
    mensagem: "quais carros você indica para o dia a dia?",
    historico: [],
    stock: [hb16, kicks],
    generate: async () => ({
      functionCall: null,
      text:
        "Aqui na nossa loja de Linhares separei opções na faixa até 80 mil com parcelas acessíveis e simulação de juros baixos no simulador:\n" +
        `• [Hyundai HB20 2015](${vehiclePath(hb16)}) — Ótimo para uso urbano com parcela baixa na nossa cidade de Linhares.\n` +
        `• [Nissan Kicks 2019](${vehiclePath(kicks)}) — Confortável e confiável. Consulte a simulação de financiamento.`,
    }),
  });

  // Abertura com Linhares/simulador/80 mil foi substituída por abertura limpa
  assert.doesNotMatch(result.reply, /Linhares|nossa cidade|\bcidade de\b|\blocal\b/i);
  assert.doesNotMatch(result.reply, /parcel|taxa|juros|simula/i);
  assert.doesNotMatch(result.reply, /80 mil|faixa/i);
  assert.equal(result.vehicles.length, 2);
});

test("Bloqueante 1b: quando o cliente pede faixa de preço expressamente, o filtro não remove a faixa", () => {
  const input = {
    reply:
      "Separei opções até 80 mil para o seu perfil:\n" +
      `• [Hyundai HB20 2015](${vehiclePath(hb16)}) — Econômico e confortável para o dia a dia.\n` +
      `• [Nissan Kicks 2019](${vehiclePath(kicks)}) — Confortável e espaçoso para a família.`,
    vehicles: [hb16, kicks].map(toChatVehicleCard),
    leadCreated: false,
    stockHref: null,
  };

  const result = formatChatResult(
    input,
    { mensagem: "quais carros você indica até 80 mil?", historico: [], stock: [hb16, kicks] },
    [hb16, kicks],
  );

  // Como o cliente perguntou "até 80 mil", a menção legítima não é barrada
  assert.match(result.reply, /80 mil/i);
  assert.equal(result.vehicles.length, 2);
});

// 2) sanitizePower: para motor 1.0/<90cv remove qualquer cv/cavalos/potência inclusive aproximados
test("Bloqueante 2: sanitizePower remove potência aproximada ou exata para motor 1.0 ou <90cv, preservando motores maiores", () => {
  const input = {
    reply:
      "Comparando os dois modelos:\n" +
      `• [Hyundai HB20 2015](${vehiclePath(hb16)}) — Motor 1.6 com cerca de 128 cv no etanol e 122 cv na gasolina.\n` +
      `• [Hyundai HB20 2022](${vehiclePath(hb10)}) — Motor 1.0 com aproximadamente 80 cv de potência para o trânsito.`,
    vehicles: [hb16, hb10].map(toChatVehicleCard),
    leadCreated: false,
    stockHref: null,
  };

  const result = formatChatResult(
    input,
    { mensagem: "qual você indica entre o hb20 1.6 e o hb20 1.0?", historico: [], stock },
    [hb16, hb10],
  );

  // O 1.6 mantém seus 128 cv
  assert.match(result.reply, /128 cv/i);
  // O 1.0 NÃO deve conter "80 cv", "cavalos" ou menção de potência do 1.0
  assert.doesNotMatch(result.reply, /80\s*cv|cavalos de potência|80\s*cavalos/i);
});

// 3) chat-turn.ts:1483: km/l na prosa da IA sem conferir com a ficha
test("Bloqueante 3: remove frase com km/l inventado que não bate com a ficha, mantendo consumo real", () => {
  // Kicks 1.6 na base tem consumo cidade gasolina = 11.4 km/l
  const inputAlucinada = {
    reply:
      "Aqui estão duas opções econômicas:\n" +
      `• [Nissan Kicks 2019](${vehiclePath(kicks)}) — Faz 22,8 km/l na cidade com gasolina e tem ótimo espaço.\n` +
      `• [Hyundai HB20 2015](${vehiclePath(hb16)}) — Compacto confiável e ágil para o trânsito.`,
    vehicles: [kicks, hb16].map(toChatVehicleCard),
    leadCreated: false,
    stockHref: null,
  };
  const resultAlucinada = formatChatResult(
    inputAlucinada,
    { mensagem: "o que você acha do consumo deles?", historico: [], stock },
    [kicks, hb16],
  );

  // Consumo absurdo de 22.8 km/l deve ser removido
  assert.doesNotMatch(resultAlucinada.reply, /22[,.]8/);

  const inputReal = {
    reply:
      "Aqui estão duas opções econômicas:\n" +
      `• [Nissan Kicks 2019](${vehiclePath(kicks)}) — Faz 11,4 km/l na cidade com gasolina e tem ótimo espaço.\n` +
      `• [Hyundai HB20 2015](${vehiclePath(hb16)}) — Compacto confiável e ágil para o trânsito.`,
    vehicles: [kicks, hb16].map(toChatVehicleCard),
    leadCreated: false,
    stockHref: null,
  };
  const resultReal = formatChatResult(
    inputReal,
    { mensagem: "o que você acha do consumo deles?", historico: [], stock },
    [kicks, hb16],
  );

  // Consumo real de 11.4 km/l é preservado
  assert.match(resultReal.reply, /11,4 km\/l/);
});

// 4) chat-stock.ts:1104 e chat-turn.ts:342: carros citados no texto devem ser exatamente os dos cards (máx 3, preferência 2)
test("Bloqueante 4: pergunta de opcional em modelo com 4 carros cita exatamente os dos cards (máx 3, preferência 2)", async () => {
  const result = await runChatTurn({
    mensagem: "qual civic tem ar condicionado?",
    historico: [],
    stock,
    generate: async () => {
      throw new Error("não deve chamar IA para filtro de opcional");
    },
  });

  // Cards devem ser no máximo 3 (preferência 2)
  assert(result.vehicles.length <= 3, `Esperava <= 3 cards, vieram ${result.vehicles.length}`);
  assert(result.vehicles.length >= 2, `Esperava >= 2 cards, vieram ${result.vehicles.length}`);

  // Os carros citados no texto devem bater com as unidades dos cards
  for (const card of result.vehicles) {
    const cardModel = card.model;
    assert(result.reply.includes(cardModel), `Resposta deve citar ${cardModel}`);
  }
  // Não deve citar 4 carros quando retorna 2 cards
  assert.doesNotMatch(result.reply, /Temos 4 Civic/i);
});

// 5) chat-turn.ts:1473 e chat-expert.test.ts:112: 'qual o mais forte?' nuance torque x cv sem 120 cv
test("Bloqueante 5: 'qual o mais forte?' preserva nuance torque × cv do 1.0 turbo e não inclui 120 cv nem veredicto simplista", async () => {
  const result = await runChatTurn({
    mensagem: "qual o mais forte?",
    historico: [
      user("me mostra os hb20"),
      assistant(
        "Hyundai HB20 Premium 1.6 Aut 2015 · 127.000 km · R$ 56.900\nHyundai HB20S Comfort Plus 1.0 TGDI Aut 2024 · 50.000 km · R$ 89.900",
      ),
    ],
    stock,
    generate: async () => {
      throw new Error("deterministico sem LLM");
    },
  });

  // Deve ter exatamente 2 cards (os 2 do histórico)
  assert.equal(result.vehicles.length, 2);
  assert.deepEqual(result.vehicles.map((veh) => veh.id).sort(), ["hb16", "hb20s"]);

  // Nuance de torque deve estar presente
  assert.match(result.reply, /torque/i);

  // Não deve ter 'em potência leva' ou declaração de vencedor simplista
  assert.doesNotMatch(result.reply, /em potência leva|leva vantagem|é melhor|ganha|vence/i);

  // Não deve divulgar 120 cv para o 1.0 turbo
  assert.doesNotMatch(result.reply, /120\s*cv/i);
});

// 6) applyChatStockFilters com 'barato e econômico' (combinedCheap): não aplica teto de ~1,35x do mais barato
test("Bloqueante 6: applyChatStockFilters com 'barato e econômico' não aplica teto cheapPriceCap de ~1,35x", () => {
  // Com pergunta apenas de 'barato', o teto de ~1,35x do mais barato (56.900 -> cap 77.000) filtra hb20s (89.900) e kicks (89.900)
  const cheapOnly = applyChatStockFilters(stock, "qual carro mais em conta você tem?");
  assert.ok(cheapOnly.every((vehicle) => vehicle.price <= 77_000));
  assert.equal(cheapOnly.some((vehicle) => vehicle.id === "hb20s"), false);

  // Com pergunta combinada 'barato e econômico', não aplica o teto de preço não pedido:
  // modelos acima do teto (como o HB20S de 89.900) continuam no pool para o ranking multicritério avaliar
  const combined = applyChatStockFilters(stock, "qual carro barato e econômico você indica?");
  assert.ok(combined.some((vehicle) => vehicle.id === "hb20s"), "HB20S deve estar no pool com critério combinado");
  assert.ok(combined.some((vehicle) => vehicle.price > 77_000), "Pool combinado não deve podar veículos acima de 1,35x");
});

test("Bloqueante 6b: runChatTurn para 'barato e econômico' não poda opções econômicas por faixa não pedida", async () => {
  const result = await runChatTurn({
    mensagem: "qual carro barato e econômico você indica?",
    historico: [],
    stock,
    generate: async () => {
      throw new Error("deterministico sem LLM para multicriterio");
    },
  });

  assert.ok(result.vehicles.length >= 2, "deve retornar cards combinando preço e economia");
  assert.doesNotMatch(result.reply, /faixa|teto|limite de pre[cç]o/i);
});

