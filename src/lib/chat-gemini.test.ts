import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import {
  CHAT_GEMINI_FALLBACK_MODEL,
  CHAT_GEMINI_MODEL,
  chatGeminiModels,
  chatThinkingLevel,
  collectGeminiParts,
  configuredModels,
  confirmAfterLead,
  extractGeminiText,
  generateChatReply,
  generateChatReplyStream,
  generationConfig,
  geminiRawFromParts,
  resetChatModelHealth,
} from "./chat-gemini";
import { looksTruncated } from "./chat-polish";

// Corpo JSON que o teste lê de volta; o formato é o da API do Gemini.
type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const realFetch = globalThis.fetch;
const env = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL, level: process.env.GEMINI_THINKING_LEVEL };

beforeEach(() => {
  process.env.GEMINI_API_KEY = "fixture-local";
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_THINKING_LEVEL;
  resetChatModelHealth();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [name, value] of [
    ["GEMINI_API_KEY", env.key],
    ["GEMINI_MODEL", env.model],
    ["GEMINI_THINKING_LEVEL", env.level],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  resetChatModelHealth();
});

const input = (extra: Record<string, unknown> = {}) => ({
  systemPrompt: "Você é o assistente da Garagem.",
  history: [{ role: "assistant" as const, content: "Oi!" }],
  mensagem: "quantos cv tem o hb20?",
  ...extra,
});

const modelOf = (url: string) => /models\/([^:]+):/.exec(url)?.[1];
const okBody = (text = "Tem 128 cv no etanol.", extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP", ...extra }],
});

function sse(frames: unknown[]) {
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

test("o padrão é o Gemini 3.5 Flash-Lite e o 2.5 Flash-Lite vem logo depois", () => {
  assert.equal(CHAT_GEMINI_MODEL, "gemini-3.5-flash-lite");
  assert.equal(CHAT_GEMINI_FALLBACK_MODEL, "gemini-2.5-flash-lite");
  assert.deepEqual(chatGeminiModels(), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash"]);
  // alias "latest" não entra: ele aponta para um Flash maior e mais caro.
  assert.equal(chatGeminiModels().some((model) => /latest/.test(model)), false);
  assert.deepEqual(configuredModels({ GEMINI_MODEL: "models/gemini-3.5-flash-lite" })[0], "gemini-3.5-flash-lite");
  // Modelo caro no env só entra por último.
  assert.equal(configuredModels({ GEMINI_MODEL: "gemini-3.6-flash" }).at(-1), "gemini-3.6-flash");
  assert.equal(configuredModels({ GEMINI_MODEL: "gemini-3.6-flash" })[0], "gemini-3.5-flash-lite");
});

test("Gemini 3.x usa thinkingLevel e não manda temperature; 2.x mantém temperature e thinkingBudget 0", () => {
  const three = generationConfig(2048, 0.7, "gemini-3.5-flash-lite");
  assert.deepEqual(three, { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "minimal" } });
  assert.deepEqual(generationConfig(2048, 0.7, "gemini-3.5-flash-lite", "low").thinkingConfig, { thinkingLevel: "low" });
  const two = generationConfig(2048, 0.7, "gemini-2.5-flash-lite");
  assert.deepEqual(two, { maxOutputTokens: 2048, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } });
  assert.deepEqual(generationConfig(2048, 0.7, "gemini-2.0-flash"), { maxOutputTokens: 2048, temperature: 0.7 });
  // thinkingBudget e thinkingLevel nunca juntos (a API devolve 400).
  assert.equal("thinkingBudget" in (three.thinkingConfig as object), false);
  process.env.GEMINI_THINKING_LEVEL = "medium";
  assert.equal(chatThinkingLevel(), "medium");
  process.env.GEMINI_THINKING_LEVEL = "ultra";
  assert.equal(chatThinkingLevel(), "minimal");
});

test("o pedido ao 3.5 leva system_instruction, thinkingLevel e nenhuma temperatura", async () => {
  const bodies: Array<Body> = [];
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url));
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json(okBody());
  }) as typeof fetch;
  const result = await generateChatReply(input());
  assert.equal(modelOf(urls[0]!), "gemini-3.5-flash-lite");
  assert.equal(result.model, "gemini-3.5-flash-lite");
  assert.equal(result.text, "Tem 128 cv no etanol.");
  assert.equal(result.calls, 1);
  assert.deepEqual(bodies[0]!.generationConfig, { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "minimal" } });
  assert.equal(bodies[0]!.system_instruction.parts[0].text, "Você é o assistente da Garagem.");
  // O último turno sempre é do usuário (prefill de turno do modelo dá 400 nos Gemini 3.x).
  assert.equal(bodies[0]!.contents.at(-1).role, "user");
  await generateChatReply(input({ thinkingLevel: "low" }));
  assert.deepEqual(bodies[1]!.generationConfig.thinkingConfig, { thinkingLevel: "low" });
});

test("404 ou 403 de modelo no 3.5 cai no 2.5 Flash-Lite e o log mostra quem respondeu", async () => {
  for (const status of [404, 403]) {
    resetChatModelHealth();
    const urls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return modelOf(String(url)) === "gemini-3.5-flash-lite"
        ? Response.json({ error: { message: "model not found" } }, { status })
        : Response.json(okBody("Resposta do 2.5."));
    }) as typeof fetch;
    const result = await generateChatReply(input());
    assert.deepEqual(urls.map(modelOf), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"], String(status));
    assert.equal(result.model, "gemini-2.5-flash-lite", String(status));
    assert.equal(result.text, "Resposta do 2.5.");
    // O 2.x recebe temperature e thinkingBudget, não thinkingLevel.
    // A próxima mensagem não repete a ida e volta ao modelo sem acesso.
    urls.length = 0;
    await generateChatReply(input());
    assert.deepEqual(urls.map(modelOf), ["gemini-2.5-flash-lite"], `memória do modelo sem acesso (${status})`);
  }
});

test("o pedido ao 2.5 de reserva usa temperature e thinkingBudget", async () => {
  const bodies: Body[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    bodies.push({ model: modelOf(String(url)), ...JSON.parse(String(init?.body)) });
    return modelOf(String(url)) === "gemini-3.5-flash-lite"
      ? Response.json({ error: {} }, { status: 404 })
      : Response.json(okBody());
  }) as typeof fetch;
  await generateChatReply(input());
  assert.deepEqual(bodies[1]!.generationConfig, { maxOutputTokens: 2048, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } });
});

test("401 não faz fila de modelos; sem acesso a nenhum modelo o erro sobe", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return Response.json({ error: { message: "key=super-secret" } }, { status: 401 });
  }) as typeof fetch;
  await assert.rejects(generateChatReply(input()), (error: Error) => !/super-secret/.test(error.message));
  assert.equal(urls.length, 1);
  resetChatModelHealth();
  urls.length = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return Response.json({ error: {} }, { status: 404 });
  }) as typeof fetch;
  await assert.rejects(generateChatReply(input()));
  assert.deepEqual(urls.map(modelOf), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash"]);
});

test("partes de pensamento não entram no texto da resposta", () => {
  const data = { candidates: [{ content: { parts: [{ text: "raciocínio interno", thought: true }, { text: "Resposta." }] } }] };
  assert.equal(extractGeminiText(data), "Resposta.");
});

test("stream: tokens, modelo e uma única chamada quando a resposta vem inteira", async () => {
  globalThis.fetch = (async () =>
    sse([
      { candidates: [{ content: { role: "model", parts: [{ text: "O HB20 1.6 tem " }] } }] },
      { candidates: [{ content: { role: "model", parts: [{ text: "cerca de 128 cv." }] }, finishReason: "STOP" }] },
    ])) as typeof fetch;
  const tokens: string[] = [];
  const result = await generateChatReplyStream(input(), { onToken: (text) => tokens.push(text) });
  assert.equal(tokens.join(""), "O HB20 1.6 tem cerca de 128 cv.");
  assert.equal(result.text, "O HB20 1.6 tem cerca de 128 cv.");
  assert.equal(result.model, "gemini-3.5-flash-lite");
  assert.equal(result.calls, 1);
  assert.equal(result.retried, false);
});

test("stream: 404 no 3.5 cai no 2.5 sem derrubar a resposta", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return modelOf(String(url)) === "gemini-3.5-flash-lite"
      ? Response.json({ error: { message: "not found" } }, { status: 404 })
      : sse([{ candidates: [{ content: { role: "model", parts: [{ text: "Segue no 2.5." }] }, finishReason: "STOP" }] }]);
  }) as typeof fetch;
  const result = await generateChatReplyStream(input());
  assert.equal(result.model, "gemini-2.5-flash-lite");
  assert.equal(result.text, "Segue no 2.5.");
  assert.deepEqual(urls.map(modelOf), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"]);
});

test("criar_lead no Gemini 3.x: a thoughtSignature volta exatamente como veio, no mesmo modelo", async () => {
  // A conversa já tem telefone, então o pedido leva a declaração criar_lead.
  const lead = input({ mensagem: "Meu nome é Maria Silva, telefone (27) 99999-0000", history: [] });
  const functionCallPart = {
    functionCall: { name: "criar_lead", args: { nome: "Maria Silva", telefone: "(27) 99999-0000" } },
    thoughtSignature: "SIG-ABC123==",
  };
  const requests: Array<{ url: string; body: Body }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push({ url: String(url), body });
    if (String(url).includes("streamGenerateContent")) {
      return sse([
        { candidates: [{ content: { role: "model", parts: [functionCallPart] } }] },
        // O quadro final do stream chega sem o functionCall: ele não pode ser a única cópia guardada.
        { candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP" }] },
      ]);
    }
    return Response.json(okBody("Pronto, Maria! Registrei seu contato."));
  }) as typeof fetch;

  const first = await generateChatReplyStream(lead, {});
  assert.deepEqual(first.functionCall, { name: "criar_lead", args: { nome: "Maria Silva", telefone: "(27) 99999-0000" } });
  const raw = first.raw as { candidates: Array<{ content: { role: string; parts: Array<Body> } }> };
  assert.equal(raw.candidates[0]!.content.role, "model");
  assert.deepEqual(raw.candidates[0]!.content.parts[0], functionCallPart);
  assert.deepEqual(requests[0]!.body.tools[0].function_declarations[0].name, "criar_lead");

  const confirmation = await confirmAfterLead({
    ...lead,
    modelContent: first.raw,
    functionName: "criar_lead",
    functionResult: { ok: true, leadId: "lead-1" },
    model: first.model,
  });
  assert.equal(confirmation, "Pronto, Maria! Registrei seu contato.");
  const sent = requests.at(-1)!;
  assert.equal(modelOf(sent.url), "gemini-3.5-flash-lite", "a assinatura só vale para o modelo que a gerou");
  const contents = sent.body.contents as Array<{ role: string; parts: Array<Body> }>;
  const modelTurn = contents.at(-2)!;
  assert.equal(modelTurn.role, "model");
  assert.equal(modelTurn.parts.find((part) => part.functionCall)?.thoughtSignature, "SIG-ABC123==");
  const last = contents.at(-1)!;
  assert.equal(last.role, "user");
  assert.deepEqual(last.parts[0]!.functionResponse, { name: "criar_lead", response: { ok: true, leadId: "lead-1" } });
  // Gemini 3.x: sem temperature também na confirmação.
  assert.equal("temperature" in sent.body.generationConfig, false);
});

test("collectGeminiParts guarda todas as partes na ordem, inclusive a de assinatura", () => {
  const parts = collectGeminiParts([
    { candidates: [{ content: { parts: [{ text: "a" }] } }] },
    { candidates: [{ content: { parts: [{ functionCall: { name: "criar_lead", args: {} }, thoughtSignature: "S" }] } }] },
    { candidates: [{ finishReason: "STOP" }] },
    null,
  ]);
  assert.equal(parts.length, 2);
  assert.equal(parts[1]!.thoughtSignature, "S");
  assert.deepEqual(geminiRawFromParts(parts, "STOP"), {
    candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }],
  });
});

test("parada natural (STOP) em parêntese, reticências ou emoji não é resposta cortada", () => {
  assert.equal(looksTruncated("O consultor confirma isso com você (no WhatsApp)", "STOP"), false);
  assert.equal(looksTruncated("Fica à vontade, qualquer coisa me chama 😉", "STOP"), false);
  assert.equal(looksTruncated("Depois a gente vê isso…", "STOP"), false);
  assert.equal(looksTruncated("Para o Fox com motor 1.6 flex", "STOP"), true);
  assert.equal(looksTruncated("O HB20 tem cerca de 128 cv no", "MAX_TOKENS"), true);
});
