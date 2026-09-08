import assert from "node:assert/strict";
import { test } from "node:test";
import { leadArgsAreComplete, parseCriarLeadArgs } from "./chat-lead";
import {
  isIncompleteStockReply,
  listStockByBudget,
  matchInterestVehicle,
  type ChatVehicleRecord,
} from "./chat-stock";
import { parsePriceLimit } from "./chat-prompt";
import {
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

test("casa interesse com o carro do estoque e ignora texto frouxo", () => {
  assert.equal(matchInterestVehicle("hyundai hb20 2022", [hb20])?.id, hb20.id);
  assert.equal(matchInterestVehicle("porsche cayenne turbo", [hb20]), null);
});

test("até 70 mil lista o HB20 e deixa o Compass de fora", () => {
  assert.equal(parsePriceLimit("Quais carros temos ate 70 mil?"), 70_000);
  const listed = listStockByBudget("Quais carros temos ate 70 mil?", [hb20, compass]);
  assert.match(listed ?? "", /HB20/);
  assert.match(listed ?? "", /64\.900/);
  assert.doesNotMatch(listed ?? "", /Compass/);
  assert.equal(
    isIncompleteStockReply("Temos ótimas opções até R$ 70 mil no momento:"),
    true,
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
      assert.match(systemPrompt, /R\$ 64900/);
      return {
        text: "Temos o Hyundai HB20 evolution 1.0 2022, 68450 km, R$ 64900, Prata.",
        functionCall: null,
      };
    },
  });
  assert.match(existing.reply, /64900/);
  assert.match(existing.reply, /68450/);
  assert.equal(existing.leadCreated, false);

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
      assert.match(systemPrompt, /FILTRO DO VISITANTE: até R\$ 70000/);
      assert.match(systemPrompt, /Hyundai HB20/);
      return {
        text: "Temos ótimas opções até R$ 70 mil no momento:",
        functionCall: null,
      };
    },
  });
  assert.match(result.reply, /HB20/);
  assert.doesNotMatch(result.reply, /Compass/);
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
  assert.match(stock.reply, /64900/);
  assert.match(stock.reply, /68450/);
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
