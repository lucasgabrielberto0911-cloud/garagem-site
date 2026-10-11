import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import {
  CHAT_GEMINI_EXPERT_THINKING_LEVEL,
  CHAT_GEMINI_FALLBACK_MODEL,
  CHAT_GEMINI_MAX_OUTPUT_TOKENS,
  CHAT_GEMINI_RETRY_OUTPUT_TOKENS,
  chatProviders,
  forcedChatFallback,
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
const ENV_NAMES = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_FALLBACK_MODEL",
  "GEMINI_THINKING_LEVEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "CHAT_FORCE_FALLBACK",
  "VERCEL_ENV",
] as const;
const saved = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));

beforeEach(() => {
  for (const name of ENV_NAMES) delete process.env[name];
  process.env.GEMINI_API_KEY = "fixture-local";
  resetChatModelHealth();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const name of ENV_NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
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
  assert.deepEqual(chatGeminiModels(), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"]);
  // alias "latest" não entra: ele aponta para um Flash maior e mais caro.
  assert.equal(chatGeminiModels().some((model) => /latest/.test(model)), false);
  assert.deepEqual(configuredModels({ GEMINI_MODEL: "models/gemini-3.5-flash-lite" })[0], "gemini-3.5-flash-lite");
  // Modelo caro no env só entra por último.
  assert.equal(configuredModels({ GEMINI_MODEL: "gemini-3.6-flash" }).at(-1), "gemini-3.6-flash");
  assert.equal(configuredModels({ GEMINI_MODEL: "gemini-3.6-flash" })[0], "gemini-3.5-flash-lite");
  // A reserva também vem do env.
  assert.deepEqual(configuredModels({ GEMINI_FALLBACK_MODEL: "gemini-2.0-flash-lite" }), [
    "gemini-3.5-flash-lite",
    "gemini-2.0-flash-lite",
  ]);
});

test("Gemini 3.x usa thinkingLevel e não manda temperature; 2.x mantém temperature e thinkingBudget 0", () => {
  const three = generationConfig(400, 0.7, "gemini-3.5-flash-lite");
  assert.deepEqual(three, { maxOutputTokens: 400, thinkingConfig: { thinkingLevel: "minimal" } });
  assert.deepEqual(generationConfig(400, 0.7, "gemini-3.5-flash-lite", "low").thinkingConfig, { thinkingLevel: "low" });
  const two = generationConfig(400, 0.7, "gemini-2.5-flash-lite");
  assert.deepEqual(two, { maxOutputTokens: 400, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } });
  assert.deepEqual(generationConfig(400, 0.7, "gemini-2.0-flash"), { maxOutputTokens: 400, temperature: 0.7 });
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
  assert.deepEqual(bodies[0]!.generationConfig, { maxOutputTokens: 400, thinkingConfig: { thinkingLevel: "minimal" } });
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
  assert.deepEqual(bodies[1]!.generationConfig, { maxOutputTokens: 400, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } });
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
  assert.deepEqual(urls.map(modelOf), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"]);
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

// ---- Cadeia de modelos: Gemini 3.5 → Gemini 2.5 → DeepSeek (OpenRouter) ----

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const isOpenRouter = (url: string | URL | Request) => String(url) === OR_URL;
const orBody = (content: string | null, extra: Record<string, unknown> = {}) => ({
  model: "deepseek/deepseek-v4.1-flash",
  choices: [{ finish_reason: "stop", message: { role: "assistant", content, ...extra } }],
});

test("limites: ~400 tokens de saída e raciocínio mínimo também nas perguntas técnicas", () => {
  assert.equal(CHAT_GEMINI_MAX_OUTPUT_TOKENS, 400);
  assert.ok(CHAT_GEMINI_RETRY_OUTPUT_TOKENS <= 200);
  assert.equal(CHAT_GEMINI_EXPERT_THINKING_LEVEL, "minimal");
});

test("resposta vazia do 3.5 nunca chega ao visitante: cai no 2.5", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return modelOf(String(url)) === "gemini-3.5-flash-lite"
      ? Response.json({ candidates: [{ content: { role: "model", parts: [] }, finishReason: "MAX_TOKENS" }] })
      : Response.json(okBody("Resposta do 2.5."));
  }) as typeof fetch;
  const result = await generateChatReply(input());
  assert.deepEqual(urls.map(modelOf), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"]);
  assert.equal(result.text, "Resposta do 2.5.");
  assert.equal(result.model, "gemini-2.5-flash-lite");
  assert.equal(result.calls, 2);
});

test("stream: resposta vazia também passa ao próximo modelo, sem emitir token vazio", async () => {
  globalThis.fetch = (async (url: string | URL | Request) =>
    modelOf(String(url)) === "gemini-3.5-flash-lite"
      ? sse([{ candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP" }] }])
      : sse([{ candidates: [{ content: { role: "model", parts: [{ text: "Do 2.5." }] }, finishReason: "STOP" }] }])) as typeof fetch;
  const tokens: string[] = [];
  const result = await generateChatReplyStream(input(), { onToken: (text) => tokens.push(text) });
  assert.deepEqual(tokens, ["Do 2.5."]);
  assert.equal(result.model, "gemini-2.5-flash-lite");
});

test("resposta cortada: uma continuação curta e nunca termina no meio da frase", async () => {
  const bodies: Body[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    return bodies.length === 1
      ? Response.json(okBody("O HB20 1.6 tem 128 cv e o HB20S TGDI entrega 120 cv com torque de 17,5 kgfm bem mais cedo, enquanto o", { finishReason: "MAX_TOKENS" }))
      : Response.json(okBody("outro depende do giro. Quer ver os dois?", { finishReason: "MAX_TOKENS" }));
  }) as typeof fetch;
  const result = await generateChatReply(input());
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1]!.generationConfig.maxOutputTokens, CHAT_GEMINI_RETRY_OUTPUT_TOKENS);
  assert.equal(result.calls, 2);
  assert.match(result.text, /[.!?]$/);
});

test("3.5 e 2.5 falham: o DeepSeek responde com o MESMO prompt e histórico, ~400 tokens e raciocínio off", async () => {
  process.env.OPENROUTER_API_KEY = "or-chave-de-teste";
  const seen: Array<{ url: string; headers: Headers; body: Body }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return isOpenRouter(url) ? Response.json(orBody("O HB20 1.0 tem 80 cv.")) : Response.json({ error: {} }, { status: 429 });
  }) as typeof fetch;
  const tokens: string[] = [];
  const result = await generateChatReplyStream(input(), { onToken: (text) => tokens.push(text) });
  assert.deepEqual(seen.map((call) => modelOf(call.url) ?? "openrouter"), ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "openrouter"]);
  const or = seen[2]!;
  assert.equal(or.headers.get("Authorization"), "Bearer or-chave-de-teste");
  assert.equal(or.body.model, "deepseek/deepseek-v4.1-flash");
  assert.equal(or.body.max_tokens, 400);
  assert.deepEqual(or.body.reasoning, { enabled: false });
  const gemini = seen[0]!.body;
  assert.equal(or.body.messages[0].role, "system");
  assert.equal(or.body.messages[0].content, gemini.system_instruction.parts[0].text);
  assert.deepEqual(
    or.body.messages.slice(1).map((m: { role: string; content: string }) => [m.role, m.content]),
    [["assistant", "Oi!"], ["user", "quantos cv tem o hb20?"]],
  );
  assert.equal(result.text, "O HB20 1.0 tem 80 cv.");
  assert.equal(result.model, "deepseek/deepseek-v4.1-flash");
  assert.equal(result.calls, 3);
  // Sem stream: o texto sai inteiro, de uma vez.
  assert.deepEqual(tokens, ["O HB20 1.0 tem 80 cv."]);
});

test("DeepSeek também entra com resposta vazia do Gemini e cobre erro 5xx e timeout", async () => {
  process.env.OPENROUTER_API_KEY = "or-chave-de-teste";
  const kinds: Array<() => Response | Promise<Response>> = [
    () => Response.json({ candidates: [] }),
    () => Response.json({ error: { message: "x" } }, { status: 503 }),
    () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    },
  ];
  for (const fail of kinds) {
    resetChatModelHealth();
    globalThis.fetch = (async (url: string | URL | Request) =>
      isOpenRouter(url) ? Response.json(orBody("Segue no DeepSeek.")) : fail()) as typeof fetch;
    const result = await generateChatReply(input());
    assert.equal(result.text, "Segue no DeepSeek.");
  }
});

test("sem OPENROUTER_API_KEY não chama o OpenRouter e o erro sobe para o fallback do chat", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return Response.json({ error: {} }, { status: 500 });
  }) as typeof fetch;
  await assert.rejects(generateChatReply(input()));
  assert.equal(urls.some((url) => url.includes("openrouter")), false);
  assert.deepEqual(chatProviders().map((p) => p.kind), ["gemini", "gemini"]);
});

test("se o DeepSeek também falhar (vazio ou timeout), o erro sobe e o chat usa o fallback", async () => {
  process.env.OPENROUTER_API_KEY = "or-chave-de-teste";
  for (const orFail of [
    () => Response.json(orBody("")),
    () => Response.json(orBody(null)),
    () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    },
  ]) {
    resetChatModelHealth();
    globalThis.fetch = (async (url: string | URL | Request) =>
      isOpenRouter(url) ? orFail() : Response.json({ error: {} }, { status: 500 })) as typeof fetch;
    await assert.rejects(generateChatReply(input()));
  }
});

test("a chave do OpenRouter não aparece em nenhum log", async () => {
  process.env.OPENROUTER_API_KEY = "or-segredo-123";
  const lines: string[] = [];
  const realWarn = console.warn;
  const realErr = console.error;
  const realInfo = console.info;
  console.warn = console.error = console.info = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  try {
    globalThis.fetch = (async () => Response.json({ error: { message: "Bearer or-segredo-123" } }, { status: 402 })) as typeof fetch;
    await assert.rejects(generateChatReply(input()));
  } finally {
    console.warn = realWarn;
    console.error = realErr;
    console.info = realInfo;
  }
  assert.ok(lines.length > 0);
  assert.equal(lines.some((line) => line.includes("or-segredo-123")), false);
});

test("criar_lead no DeepSeek: ferramenta em formato OpenAI e confirmação fixa (sem turno de função)", async () => {
  process.env.OPENROUTER_API_KEY = "or-chave-de-teste";
  let orBodySeen: Body | null = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (!isOpenRouter(url)) return Response.json({ error: {} }, { status: 500 });
    orBodySeen = JSON.parse(String(init?.body));
    return Response.json(
      orBody(null, {
        tool_calls: [{ type: "function", function: { name: "criar_lead", arguments: '{"nome":"Ana Souza","telefone":"27 99999-1234"}' } }],
      }),
    );
  }) as typeof fetch;
  const result = await generateChatReply(
    input({ mensagem: "Quero o Civic. Meu nome é Ana Souza e meu zap é 27 99999-1234" }),
  );
  assert.equal(orBodySeen!.tools[0].function.name, "criar_lead");
  assert.equal(orBodySeen!.tools[0].function.parameters.type, "object");
  assert.equal(orBodySeen!.tools[0].function.parameters.properties.nome.type, "string");
  assert.deepEqual(result.functionCall, { name: "criar_lead", args: { nome: "Ana Souza", telefone: "27 99999-1234" } });
  // Vazio = o chat-turn usa a frase fixa de confirmação.
  const confirmation = await confirmAfterLead({
    systemPrompt: "x",
    history: [],
    mensagem: "x",
    modelContent: undefined,
    functionName: "criar_lead",
    functionResult: { ok: true },
    model: result.model,
  });
  assert.equal(confirmation, "");
});

test("CHAT_FORCE_FALLBACK=openrouter só vale fora da produção", async () => {
  process.env.OPENROUTER_API_KEY = "or-chave-de-teste";
  process.env.CHAT_FORCE_FALLBACK = "openrouter";
  assert.equal(forcedChatFallback(), "openrouter");
  assert.deepEqual(chatProviders().map((p) => p.kind), ["openrouter"]);
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return Response.json(orBody("Direto do DeepSeek."));
  }) as typeof fetch;
  const result = await generateChatReply(input());
  assert.deepEqual(urls, [OR_URL]);
  assert.equal(result.model, "deepseek/deepseek-v4.1-flash");
  process.env.VERCEL_ENV = "production";
  assert.equal(forcedChatFallback(), null);
  assert.deepEqual(chatProviders().map((p) => p.kind), ["gemini", "gemini", "openrouter"]);
});

test("OPENROUTER_MODEL troca o modelo da terceira reserva", async () => {
  process.env.OPENROUTER_API_KEY = "or-chave-de-teste";
  process.env.OPENROUTER_MODEL = "deepseek/outro";
  process.env.CHAT_FORCE_FALLBACK = "openrouter";
  let model = "";
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    model = JSON.parse(String(init?.body)).model;
    return Response.json({ ...orBody("ok"), model: "deepseek/outro" });
  }) as typeof fetch;
  const result = await generateChatReply(input());
  assert.equal(model, "deepseek/outro");
  assert.equal(result.model, "deepseek/outro");
});
