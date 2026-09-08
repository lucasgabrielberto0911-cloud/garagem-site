import assert from "node:assert/strict";
import { test } from "node:test";
import { leadArgsAreComplete, parseCriarLeadArgs } from "./chat-lead";
import {
  chatFilterIntro,
  compareChatStockPicks,
  isIncompleteStockReply,
  listStockByBudget,
  matchInterestVehicle,
  type ChatVehicleRecord,
} from "./chat-stock";
import { parsePriceLimit } from "./chat-prompt";
import {
  CHAT_GEMINI_MODEL,
  chatGeminiModels,
  extractGeminiFunctionCall,
  extractGeminiText,
  geminiApiKey,
  normalizeGeminiKey,
  redactGeminiError,
} from "./chat-gemini";
import { runChatTurn } from "./chat-turn";
import { checkRateLimit, clearRateLimit } from "./rate-limit";

const compass: ChatVehicleRecord = {
  id: "c-compass-2022",
  brand: "Jeep",
  model: "Compass",
  version: "longitude",
  yearModel: 2022,
  km: 40000,
  price: 129900,
  color: "Branco",
  transmission: "Automático",
  fuel: "Flex",
};

const hb20: ChatVehicleRecord = {
  id: "c-hb20-2022",
  brand: "Hyundai",
  model: "HB20",
  version: "evolution 1.0",
  yearModel: 2022,
  km: 68450,
  price: 64900,
  color: "Prata",
  transmission: "Manual",
  fuel: "Flex",
};

test("recorte da pergunta vira frase curta", () => {
  assert.equal(chatFilterIntro("Carros até 70 mil?"), "Carros até R$ 70.000.");
  assert.equal(
    chatFilterIntro("Automático até 80 mil?"),
    "Automáticos até R$ 80.000.",
  );
  assert.equal(chatFilterIntro("moto até 15 mil"), "Motos até R$ 15.000.");
  assert.equal(chatFilterIntro("eae"), "");
});

test("casa interesse com o carro do estoque e ignora texto frouxo", () => {
  assert.equal(matchInterestVehicle("hyundai hb20 2022", [hb20])?.id, hb20.id);
  assert.equal(matchInterestVehicle("porsche cayenne turbo", [hb20]), null);
});

test("até 70 mil lista o HB20 e deixa o Compass de fora", () => {
  assert.equal(parsePriceLimit("Quais carros temos ate 70 mil?"), 70_000);
  assert.equal(parsePriceLimit("carros de 70 mil"), 70_000);
  assert.equal(parsePriceLimit("orcamento 80 mil"), 80_000);
  const listed = listStockByBudget("Quais carros temos ate 70 mil?", [hb20, compass]);
  assert.match(listed ?? "", /HB20/);
  assert.match(listed ?? "", /64\.900/);
  assert.doesNotMatch(listed ?? "", /Compass/);
  assert.match(listed ?? "", /mais em conta/);
  assert.match(listed ?? "", /consumo|catálogo|catalogo/);
  assert.match(listed ?? "", /não foi medido/);
  assert.equal(
    isIncompleteStockReply("Temos ótimas opções até R$ 70 mil no momento:"),
    true,
  );
  assert.equal(
    isIncompleteStockReply(
      "Temos estas opções até R$ 70.000 no estoque: Chevrolet Prisma Sed. Joy/LS 1.0 8V FlexPower 4p",
    ),
    true,
  );
  assert.equal(
    isIncompleteStockReply(
      "Até R$ 70.000:\nHyundai HB20 2022 · 68.450 km · R$ 64.900\nChevrolet Onix 2014 · 32.500 km · R$ 56.900",
    ),
    false,
  );
});

test("criar_lead só fecha com nome e telefone válidos", () => {
  assert.equal(
    leadArgsAreComplete(
      parseCriarLeadArgs({ nome: "Maria Silva", telefone: "(27) 99999-0000" }),
    ),
    true,
  );
  assert.equal(
    leadArgsAreComplete(parseCriarLeadArgs({ nome: "Li", telefone: "9999" })),
    false,
  );
});

test("usa Gemini Flash-Lite primeiro, o modelo mais barato da fila", () => {
  assert.equal(CHAT_GEMINI_MODEL, "gemini-2.5-flash-lite");
  const prev = process.env.GEMINI_MODEL;
  delete process.env.GEMINI_MODEL;
  try {
    assert.equal(chatGeminiModels()[0], "gemini-2.5-flash-lite");
    process.env.GEMINI_MODEL = "gemini-2.5-pro";
    assert.equal(chatGeminiModels()[0], "gemini-2.5-flash-lite");
    assert.equal(chatGeminiModels().includes("gemini-2.5-pro"), true);
  } finally {
    if (prev === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prev;
  }
});

test("chave Gemini aceita nome alternativo e o erro não vaza segredo", () => {
  assert.equal(normalizeGeminiKey("  GEMINI_API_KEY=abc123  "), "abc123");
  assert.match(redactGeminiError("failed key=super-secret-token"), /redacted/);
  const prev = process.env.GEMINI_API_KEY;
  const prevAlt = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "alt-key";
  try {
    assert.equal(geminiApiKey(), "alt-key");
  } finally {
    if (prev === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prev;
    if (prevAlt === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevAlt;
  }
});

test("Gemini devolve texto e function call criar_lead", () => {
  const payload = {
    candidates: [
      {
        content: {
          parts: [
            { text: "Anota aí que vou registrar." },
            {
              functionCall: {
                name: "criar_lead",
                args: {
                  nome: "João Costa",
                  telefone: "27996330706",
                  veiculo_interesse: "Hyundai HB20 2022",
                  mensagem: "Quer financiar",
                },
              },
            },
          ],
        },
      },
    ],
  };
  assert.match(extractGeminiText(payload), /registrar/);
  const call = extractGeminiFunctionCall(payload);
  assert.equal(call?.name, "criar_lead");
});

test("turno com carro do estoque, carro inexistente e lead", async () => {
  const existing = await runChatTurn({
    mensagem: "Tem o HB20 2022? Qual o preço e a km?",
    historico: [],
    stock: [hb20],
    generate: async ({ systemPrompt }) => {
      assert.match(systemPrompt, /Hyundai HB20 evolution 1\.0 2022/);
      assert.match(systemPrompt, /R\$ 64\.900/);
      return {
        text: "Temos o Hyundai HB20 evolution 1.0 2022, 68450 km, R$ 64900, Prata.",
        functionCall: null,
      };
    },
  });
  assert.match(existing.reply, /64900/);
  assert.match(existing.reply, /68450/);
  assert.equal(existing.leadCreated, false);
  assert.equal(existing.vehicles.length, 1);
  assert.equal(existing.vehicles[0]?.id, hb20.id);
  assert.match(existing.vehicles[0]?.href ?? "", /estoque/);

  const missing = await runChatTurn({
    mensagem: "Tem Porsche Cayenne 2024?",
    historico: [],
    stock: [hb20],
    generate: async ({ systemPrompt }) => {
      assert.doesNotMatch(systemPrompt, /Cayenne/);
      return {
        text: "Esse modelo não está na lista atual. Fala com a gente no WhatsApp: https://wa.me/5527996330706",
        functionCall: null,
      };
    },
  });
  assert.match(missing.reply, /não está na lista atual/i);
  assert.match(missing.reply, /wa\.me\/5527996330706/);

  const created: Array<{ source: string; name: string; status?: string }> = [];
  const lead = await runChatTurn({
    mensagem: "Quero o HB20. Meu nome é Ana Souza, telefone 27988887777.",
    historico: [],
    stock: [hb20],
    generate: async () => ({
      text: "",
      functionCall: {
        name: "criar_lead",
        args: {
          nome: "Ana Souza",
          telefone: "27988887777",
          veiculo_interesse: "Hyundai HB20 2022",
          mensagem: "Quer o HB20",
        },
      },
    }),
    confirm: async () => "Lead anotado, Ana. Um consultor te chama.",
    createLead: async (args) => {
      created.push({ source: "chatbot-site", name: args.nome ?? "" });
      return { id: "lead_test", matchedVehicleId: hb20.id };
    },
  });
  assert.equal(lead.leadCreated, true);
  assert.equal(created[0]?.source, "chatbot-site");
  assert.match(lead.reply, /Ana/);
});

test("lista vazia do modelo é preenchida com o estoque até o valor", async () => {
  const result = await runChatTurn({
    mensagem: "Quais carros temos ate 70 mil?",
    historico: [],
    stock: [hb20, compass],
    generate: async ({ systemPrompt }) => {
      assert.match(systemPrompt, /FILTRO DO VISITANTE: até R\$ 70\.000/);
      assert.match(systemPrompt, /Hyundai HB20/);
      return {
        text: "Temos ótimas opções até R$ 70 mil no momento:",
        functionCall: null,
      };
    },
  });
  assert.match(result.reply, /HB20/);
  assert.doesNotMatch(result.reply, /Compass/);
  assert.match(result.reply, /consumo|catálogo|1\.0 flex/);
  assert.equal(result.vehicles.length, 1);
  assert.equal(result.vehicles[0]?.id, hb20.id);
});

test("resposta seca do modelo ganha comparação e consumo do estoque", async () => {
  const palio: ChatVehicleRecord = {
    id: "c-palio-2016",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    yearModel: 2016,
    km: 156400,
    price: 47900,
    color: "Branca",
    transmission: "Manual",
    fuel: "Flex",
    engine: "1.8 16V",
    category: "carro",
  };
  const prismaJoy: ChatVehicleRecord = {
    id: "c-prisma-2019",
    brand: "Chevrolet",
    model: "Prisma",
    version: "Sed. Joy/LS 1.0",
    yearModel: 2019,
    km: 152000,
    price: 52900,
    color: "Prata",
    transmission: "Manual",
    fuel: "Flex",
    engine: "1.0",
    category: "carro",
  };
  const hb20Auto: ChatVehicleRecord = {
    ...hb20,
    id: "c-hb20-2015-auto",
    yearModel: 2015,
    km: 127000,
    price: 55900,
    transmission: "Automático",
    version: "Comfort 1.0",
    engine: "1.0",
  };
  const compared = compareChatStockPicks([palio, prismaJoy, hb20Auto]);
  assert.match(compared, /Palio Weekend/);
  assert.match(compared, /mais em conta/);
  assert.match(compared, /HB20/);
  assert.match(compared, /Prisma e HB20/);
  assert.match(compared, /Prisma é o mais novo \(2019\)/);
  assert.match(compared, /automático da lista/);
  assert.match(compared, /11–14/);
  assert.match(compared, /8–11/);
  assert.match(compared, /foi medido na loja/i);
  assert.match(compared, /\n\n/);
  assert.doesNotMatch(compared, /Entre esses/);
  assert.doesNotMatch(compared, /Todos são automático/);
  assert.doesNotMatch(compared, /Fiat Palio Weekend é o mais em conta/);

  const result = await runChatTurn({
    mensagem: "Quais carros até 70 mil?",
    historico: [],
    stock: [palio, prismaJoy, hb20Auto],
    generate: async () => ({
      text: `Até R$ 70.000 eu começaria por estes:
Fiat Palio Weekend Adventure 1.8 Flex 16V 2016 · 156.400 km · R$ 47.900
Chevrolet Prisma Sed. Joy/LS 1.0 2019 · 152.000 km · R$ 52.900
Hyundai HB20 Comfort 1.0 2015 · 127.000 km · R$ 55.900`,
      functionCall: null,
    }),
  });
  assert.match(result.reply, /70\.000/);
  assert.match(result.reply, /mais em conta/);
  assert.match(result.reply, /Prisma e HB20/);
  assert.match(result.reply, /Prisma é o mais novo/);
  assert.match(result.reply, /consumo|catálogo|11–14/);
  assert.match(result.reply, /automático/);
  assert.match(result.reply, /\n\n/);
  assert.equal(result.vehicles.length, 3);
});

test("comparação fala dos cards na tela, não de um Onix que o modelo inventou", async () => {
  const palio: ChatVehicleRecord = {
    id: "c-palio-2016-b",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    yearModel: 2016,
    km: 156400,
    price: 47900,
    color: "Branca",
    transmission: "Manual",
    fuel: "Flex",
    engine: "1.8 16V",
    category: "carro",
  };
  const prismaJoy: ChatVehicleRecord = {
    id: "c-prisma-2019-b",
    brand: "Chevrolet",
    model: "Prisma",
    version: "Sed. Joy/LS 1.0",
    yearModel: 2019,
    km: 152000,
    price: 52900,
    color: "Prata",
    transmission: "Manual",
    fuel: "Flex",
    engine: "1.0",
    category: "carro",
  };
  const hb20Auto: ChatVehicleRecord = {
    ...hb20,
    id: "c-hb20-2015-b",
    yearModel: 2015,
    km: 127000,
    price: 55900,
    transmission: "Automático",
    version: "Premium Automatico 1.6",
    engine: "1.6",
  };
  const result = await runChatTurn({
    mensagem: "Quais carros até 70 mil?",
    historico: [],
    stock: [palio, prismaJoy, hb20Auto],
    generate: async () => ({
      text: `Separei 3 opções até R$ 70.000. A Palio é mais em conta. O Onix lt/ltz é automático com 32 mil km. O HB20 Evolution 1.0 faz 11 a 14 km/l.
Fiat Palio Weekend Adventure 1.8 Flex 16V 2016 · 156.400 km · R$ 47.900
Chevrolet Prisma Sed. Joy/LS 1.0 2019 · 152.000 km · R$ 52.900
Hyundai HB20 Premium Automatico 1.6 2015 · 127.000 km · R$ 55.900`,
      functionCall: null,
    }),
  });
  assert.match(result.reply, /Carros até R\$ 70\.000/);
  assert.match(result.reply, /Prisma/);
  assert.match(result.reply, /Palio Weekend/);
  assert.match(result.reply, /HB20/);
  assert.doesNotMatch(result.reply, /Onix/);
  assert.doesNotMatch(result.reply, /Evolution/);
  assert.doesNotMatch(result.reply, /Separei 3/);
  assert.match(result.reply, /não foi medido|foi medido na loja/);
});

test("comparação fala Lancer, não LANCER", () => {
  const hb20Auto: ChatVehicleRecord = {
    ...hb20,
    id: "c-hb20-auto-case",
    yearModel: 2015,
    km: 127300,
    price: 55900,
    transmission: "Automático",
    engine: "1.6",
    category: "carro",
  };
  const onixAuto: ChatVehicleRecord = {
    ...hb20,
    id: "c-onix-auto-case",
    brand: "Chevrolet",
    model: "Onix",
    yearModel: 2014,
    km: 32500,
    price: 56900,
    transmission: "Automático",
    engine: "1.4",
    category: "carro",
  };
  const lancer: ChatVehicleRecord = {
    ...hb20,
    id: "c-lancer-auto-case",
    brand: "Mitsubishi",
    model: "LANCER",
    yearModel: 2014,
    km: 80000,
    price: 62900,
    transmission: "Automático",
    engine: "2.0",
    category: "carro",
  };
  const compared = compareChatStockPicks([hb20Auto, onixAuto, lancer]);
  assert.match(compared, /Lancer/);
  assert.doesNotMatch(compared, /LANCER/);
  assert.match(compared, /HB20/);
  assert.match(compared, /Onix/);
  assert.match(compared, /meio do preço/);
  assert.doesNotMatch(compared, /Entre esses/);
});

test("eae recusado pelo modelo vira cumprimento da loja", async () => {
  const result = await runChatTurn({
    mensagem: "eae",
    historico: [],
    stock: [],
    generate: async () => ({
      text: "Posso ajudar só com assuntos da Garagem: estoque, compra, venda, troca, financiamento e garantia.",
      functionCall: null,
    }),
  });
  assert.match(result.reply, /estoque/);
  assert.doesNotMatch(result.reply, /só com assuntos da Garagem/);
});

test("Gemini fora do ar ainda responde o estoque e o financiamento", async () => {
  const stock = await runChatTurn({
    mensagem: "Tem o HB20 2022? Qual o preço e a km?",
    historico: [],
    stock: [hb20],
    generate: async () => {
      throw new Error("quota");
    },
  });
  assert.match(stock.reply, /64\.900/);
  assert.match(stock.reply, /68\.450/);
  assert.match(stock.reply, /consumo|catálogo|1\.0 flex/);
  assert.equal(stock.leadCreated, false);

  const finance = await runChatTurn({
    mensagem: "Vocês financiam em quantas vezes?",
    historico: [],
    stock: [],
    generate: async () => {
      throw new Error("quota");
    },
  });
  assert.match(finance.reply, /60x/);
  assert.match(finance.reply, /WhatsApp/);
});

test("sessão do chat bloqueia depois de 30 mensagens", () => {
  const key = `chat-test-${Date.now()}`;
  try {
    for (let i = 0; i < 30; i += 1) {
      assert.equal(checkRateLimit(key, { windowMs: 60_000, max: 30 }).ok, true);
    }
    assert.equal(checkRateLimit(key, { windowMs: 60_000, max: 30 }).ok, false);
  } finally {
    clearRateLimit(key);
  }
});
