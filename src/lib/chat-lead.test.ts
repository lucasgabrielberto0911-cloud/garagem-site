import assert from "node:assert/strict";
import { test } from "node:test";
import { leadArgsAreComplete, parseCriarLeadArgs } from "./chat-lead";
import { matchInterestVehicle, type ChatVehicleRecord } from "./chat-stock";
import { extractGeminiFunctionCall, extractGeminiText } from "./chat-gemini";
import { runChatTurn } from "./chat-turn";
import { checkRateLimit, clearRateLimit } from "./rate-limit";

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

test("Gemini fora do ar devolve fallback com WhatsApp", async () => {
  const result = await runChatTurn({
    mensagem: "oi",
    historico: [],
    stock: [],
    generate: async () => {
      throw new Error("quota");
    },
  });
  assert.match(result.reply, /WhatsApp/);
  assert.equal(result.leadCreated, false);
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
