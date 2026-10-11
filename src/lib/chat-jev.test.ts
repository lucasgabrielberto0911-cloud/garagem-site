import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_READING_QUESTIONS,
  buildReadingState,
  chatReadingHint,
  composeLeadNotes,
  formatReadingNote,
  parseChatReading,
  readChatIntent,
  readingWithin,
  redactForJev,
  shouldReadChat,
  type ChatReading,
} from "./chat-jev";
import type { ChatVehicleRecord } from "./chat-stock";
import { runChatTurn } from "./chat-turn";

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
  locationCity: "Linhares",
};

/** Formato real da resposta do Jev (score = índice da escala, choice com probabilities). */
function answers(heat: number, heatConfidence: number, choice: string, choiceConfidence: number) {
  return {
    temperatura: {
      type: "score",
      score: heat,
      confidence: heatConfidence,
      legend: { "0": "frio", "1": "morno", "2": "quente" },
      probabilities: { "0": 0, "1": 0, "2": 1 },
    },
    intencao: {
      type: "choice",
      choice,
      confidence: choiceConfidence,
      probabilities: { [choice]: choiceConfidence },
    },
  };
}

const quenteFinanciar: ChatReading = { heat: "quente", intent: "financiar" };

test("as duas perguntas vão no mesmo pedido, com escala de 3 níveis e 5 intenções", () => {
  assert.deepEqual(Object.keys(CHAT_READING_QUESTIONS), ["temperatura", "intencao"]);
  const heat = CHAT_READING_QUESTIONS.temperatura;
  assert.equal(heat.type === "score" && heat.criteria.length, 3);
  const intent = CHAT_READING_QUESTIONS.intencao;
  assert.deepEqual(
    intent.type === "choice" && Object.keys(intent.criteria),
    ["financiar", "trocar", "visitar", "preco", "curioso"],
  );
});

test("parseChatReading lê a resposta real do Jev", () => {
  assert.deepEqual(parseChatReading(answers(2, 1, "financiar", 0.95)), quenteFinanciar);
  assert.deepEqual(parseChatReading(answers(0, 1, "curioso", 0.77)), {
    heat: "frio",
    intent: "curioso",
  });
  assert.deepEqual(parseChatReading(answers(1, 0.8, "visitar", 0.9)), {
    heat: "morno",
    intent: "visitar",
  });
  // 1,61 de 0–2 (exemplo real) fica na faixa quente
  assert.equal(parseChatReading(answers(1.61, 0.68, "visitar", 1))?.heat, "quente");
});

test("confiança baixa ou resposta estranha não vira rótulo", () => {
  assert.deepEqual(parseChatReading(answers(2, 0.3, "financiar", 0.9)), {
    heat: null,
    intent: "financiar",
  });
  assert.equal(parseChatReading(answers(2, 0.3, "financiar", 0.2)), null);
  assert.equal(parseChatReading(answers(2, 1, "inventada", 1))?.intent, null);
  assert.equal(parseChatReading(null), null);
  assert.equal(parseChatReading({}), null);
  assert.equal(parseChatReading({ temperatura: "quente", intencao: 3 }), null);
});

test("nota curta e humana, sem nota quebrada", () => {
  assert.equal(formatReadingNote(quenteFinanciar), "Quente · quer financiar");
  assert.equal(formatReadingNote({ heat: "frio", intent: "curioso" }), "Frio · só pesquisando");
  assert.equal(formatReadingNote({ heat: "morno", intent: null }), "Morno");
  assert.equal(formatReadingNote({ heat: null, intent: "trocar" }), "quer dar o carro na troca");
  assert.equal(formatReadingNote({ heat: null, intent: null }), "");
  assert.equal(formatReadingNote(null), "");
  assert.equal(formatReadingNote(undefined), "");
});

test("notas do lead: leitura na primeira linha; sem leitura fica como antes", () => {
  assert.equal(
    composeLeadNotes("Quer o HB20", quenteFinanciar),
    "Leitura: Quente · quer financiar\nQuer o HB20",
  );
  assert.equal(composeLeadNotes("Quer o HB20", null), "Quer o HB20");
  assert.equal(composeLeadNotes("", null), null);
  assert.equal(composeLeadNotes("", quenteFinanciar), "Leitura: Quente · quer financiar");
  assert.doesNotMatch(composeLeadNotes("Quer o HB20", null) ?? "", /undefined|null|Leitura/);
});

test("instrução ao assistente é texto fixo, vazia sem leitura", () => {
  assert.equal(chatReadingHint(null), "");
  assert.equal(chatReadingHint({ heat: null, intent: null }), "");
  const hint = chatReadingHint(quenteFinanciar);
  assert.match(hint, /entrada/);
  assert.match(hint, /nunca cite/i);
  assert.match(hint, /sem pressão/);
  assert.doesNotMatch(hint, /R\$|Linhares/);
  assert.match(chatReadingHint({ heat: "frio", intent: "curioso" }), /não peça nome nem telefone/);
  assert.match(chatReadingHint({ heat: null, intent: "visitar" }), /WhatsApp/);
  assert.doesNotMatch(chatReadingHint({ heat: null, intent: "visitar" }), /endereço de/i);
});

test("o estado do Jev sai sem telefone, e-mail, CPF, preço nem cidade", () => {
  const state = buildReadingState({
    mensagem: "Sou a Ana, tel (27) 98888-7777, ana@exemplo.com, CPF 123.456.789-09. Quero o HB20",
    historico: [
      { role: "assistant", content: "Posso ajudar com o HB20 por R$ 64.900?" },
      { role: "user", content: "meu zap 27988887777" },
    ],
    vehicle: hb20,
  });
  const blob = JSON.stringify(state);
  assert.doesNotMatch(blob, /98888|988887777|ana@|123\.456|09\b/);
  assert.doesNotMatch(blob, /Linhares|locationCity|price|preco/i);
  assert.match(blob, /\[número\]/);
  assert.match(blob, /\[e-mail\]/);
  assert.equal(state.veiculo_na_tela, "Hyundai HB20 2022");
  assert.equal(state.conversa.at(-1)?.de, "visitante");
  assert.match(blob, /Quero o HB20/);
});

test("estado fica compacto: últimas 6 mensagens, recortadas", () => {
  const historico = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 ? ("assistant" as const) : ("user" as const),
    content: `mensagem ${i} ${"x".repeat(500)}`,
  }));
  const state = buildReadingState({ mensagem: "e agora", historico });
  assert.equal(state.conversa.length, 6);
  assert.ok(state.conversa.every((turn) => turn.texto.length <= 300));
  assert.equal(state.veiculo_na_tela, null);
  assert.equal(redactForJev("R$ 64.900 em 2022, km 68450", 100), "R$ 64.900 em 2022, km 68450");
});

test("pings e agradecimentos não gastam chamada", () => {
  assert.equal(shouldReadChat("oi"), false);
  assert.equal(shouldReadChat("obrigado"), false);
  assert.equal(shouldReadChat(" "), false);
  assert.equal(shouldReadChat("Quero financiar o HB20"), true);
});

test("readChatIntent: uma chamada, resposta boa vira leitura", async () => {
  const bodies: Array<{ questions: Record<string, unknown> }> = [];
  const reading = await readChatIntent({
    mensagem: "Quero financiar o HB20, tenho entrada",
    historico: [],
    vehicle: hb20,
    apiKey: "k",
    fetcher: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ answers: answers(2, 1, "financiar", 0.95) }));
    },
  });
  assert.deepEqual(reading, quenteFinanciar);
  assert.equal(bodies.length, 1);
  assert.deepEqual(Object.keys(bodies[0].questions), ["temperatura", "intencao"]);
});

test("readChatIntent: sem chave, erro, timeout ou lixo → null, sem lançar", async () => {
  const saved = process.env.JEV_API_KEY;
  delete process.env.JEV_API_KEY;
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    let calls = 0;
    const base = { mensagem: "Quero financiar o HB20", historico: [] };
    const countingFetch = async () => {
      calls += 1;
      return new Response("{}");
    };
    assert.equal(await readChatIntent({ ...base, fetcher: countingFetch }), null);
    assert.equal(calls, 0);
    assert.equal(
      await readChatIntent({
        ...base,
        apiKey: "k",
        fetcher: async () => new Response("erro", { status: 500 }),
      }),
      null,
    );
    assert.equal(
      await readChatIntent({
        ...base,
        apiKey: "k",
        fetcher: async () => {
          throw new TypeError("fetch failed");
        },
      }),
      null,
    );
    assert.equal(
      await readChatIntent({
        ...base,
        apiKey: "k",
        fetcher: async () => new Response("não é json"),
      }),
      null,
    );
    assert.equal(
      await readChatIntent({
        ...base,
        apiKey: "k",
        fetcher: async () => new Response(JSON.stringify({ answers: { temperatura: 1 } })),
      }),
      null,
    );
    // ping: nem chega a chamar
    await readChatIntent({ mensagem: "oi", historico: [], apiKey: "k", fetcher: countingFetch });
    assert.equal(calls, 0);
  } finally {
    console.warn = warn;
    if (saved !== undefined) process.env.JEV_API_KEY = saved;
  }
});

test("readingWithin larga a leitura lenta ou quebrada depois do prazo", async () => {
  const started = Date.now();
  const slow = new Promise<ChatReading | null>(() => undefined);
  assert.equal(await readingWithin(slow, 30), null);
  assert.ok(Date.now() - started < 500);
  assert.equal(await readingWithin(Promise.reject(new Error("x")), 30), null);
  assert.deepEqual(await readingWithin(Promise.resolve(quenteFinanciar), 30), quenteFinanciar);
});

// Mensagem que de fato chega ao modelo (orçamento seco e saudação são respondidos localmente).
const BUDGET_MESSAGE = "Quero ver o HB20 no sábado";
const stockReply = async ({ systemPrompt }: { systemPrompt: string }) => {
  prompts.push(systemPrompt);
  return { text: "Olha só: o HB20 Evolution 2022 por R$ 64.900.", functionCall: null };
};
const prompts: string[] = [];

test("turno com leitura orienta o prompt e a resposta pública não carrega a leitura", async () => {
  prompts.length = 0;
  const result = await runChatTurn({
    mensagem: BUDGET_MESSAGE,
    historico: [],
    stock: [hb20],
    generate: stockReply,
    readIntent: async () => quenteFinanciar,
  });
  assert.match(prompts[0], /LEITURA INTERNA DO VISITANTE/);
  assert.match(prompts[0], /entrada/);
  assert.doesNotMatch(JSON.stringify(result), /Quente|LEITURA|financiar\b.*leitura/i);
  assert.equal("reading" in result, false);
});

test("Jev sem resposta, quebrado ou lento: o prompt e a resposta ficam como hoje", async () => {
  const base = { mensagem: BUDGET_MESSAGE, historico: [], stock: [hb20], generate: stockReply };
  prompts.length = 0;
  const plain = await runChatTurn({ ...base, readIntent: async () => null });
  const baseline = prompts[0];
  assert.doesNotMatch(baseline, /LEITURA INTERNA/);

  prompts.length = 0;
  const broken = await runChatTurn({
    ...base,
    readIntent: () => Promise.reject(new Error("jev caiu")),
  });
  assert.equal(prompts[0], baseline);
  assert.equal(broken.reply, plain.reply);

  prompts.length = 0;
  const started = Date.now();
  const slow = await runChatTurn({
    ...base,
    readIntent: () => new Promise<ChatReading | null>(() => undefined),
  });
  assert.ok(Date.now() - started < 1_500, "a leitura lenta não pode segurar o turno");
  assert.equal(prompts[0], baseline);
  assert.equal(slow.reply, plain.reply);
});

test("turno que não vai ao modelo (saudação, FIPE) nem chama o Jev", async () => {
  let calls = 0;
  const readIntent = async () => {
    calls += 1;
    return quenteFinanciar;
  };
  await runChatTurn({ mensagem: "oi", historico: [], stock: [hb20], readIntent });
  await runChatTurn({
    mensagem: "qual o preço da fipe do HB20?",
    historico: [],
    stock: [hb20],
    readIntent,
  });
  assert.equal(calls, 0);
});

const leadCall = {
  nome: "Ana Souza",
  telefone: "27988887777",
  veiculo_interesse: "Hyundai HB20 2022",
  mensagem: "Quer financiar o HB20",
};

async function leadTurn(readIntent: Parameters<typeof runChatTurn>[0]["readIntent"]) {
  const seen: Array<{ reading?: ChatReading | null } | undefined> = [];
  const result = await runChatTurn({
    mensagem: "Quero o HB20. Meu nome é Ana Souza, telefone 27988887777.",
    historico: [],
    stock: [hb20],
    generate: async () => ({
      text: "",
      functionCall: { name: "criar_lead", args: leadCall },
    }),
    confirm: async () => "Lead anotado, Ana.",
    createLead: async (_args, _stock, opts) => {
      seen.push(opts);
      return { id: "lead_1", matchedVehicleId: hb20.id };
    },
    readIntent,
  });
  return { result, seen };
}

test("lead criado leva a leitura do Jev para o registro", async () => {
  const { result, seen } = await leadTurn(async () => quenteFinanciar);
  assert.equal(result.leadCreated, true);
  assert.deepEqual(seen[0]?.reading, quenteFinanciar);
});

test("lead criado sem leitura (Jev fora do ar) segue normal e sem nota", async () => {
  for (const readIntent of [
    async () => null,
    () => Promise.reject(new Error("jev caiu")),
    () => {
      throw new Error("jev lançou direto");
    },
    () => new Promise<ChatReading | null>(() => undefined),
  ]) {
    const started = Date.now();
    const { result, seen } = await leadTurn(readIntent);
    assert.equal(result.leadCreated, true);
    assert.equal(seen[0]?.reading ?? null, null);
    assert.ok(Date.now() - started < 3_000);
  }
});
