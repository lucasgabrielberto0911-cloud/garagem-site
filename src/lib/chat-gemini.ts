import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import { chatTurnMayCreateLead } from "@/lib/chat-guard";
import {
  looksTruncated,
  mergeContinuation,
  closeTruncatedReply,
} from "@/lib/chat-polish";
import {
  generateOpenRouterReply,
  openRouterConfigured,
} from "@/lib/chat-openrouter";
import { drainJsonSseBuffer, parseJsonSseFrames } from "@/lib/chat-stream";

/** Padrão do chat: Gemini 3.5 Flash-Lite (GA), barato e rápido. Muda por GEMINI_MODEL. */
export const CHAT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Se a chave não tiver acesso ao 3.5 (404/403 de modelo), o chat segue neste. */
export const CHAT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";

/** Só vale para 2.x. Nos Gemini 3.x a temperatura fica no padrão (1.0): a doc avisa que mexer piora. */
export const CHAT_GEMINI_TEMPERATURE = 0.7;

/** Nível de raciocínio dos Gemini 3.x. `minimal` mantém a latência de chat. */
export type ChatThinkingLevel = "minimal" | "low" | "medium" | "high";
export const CHAT_GEMINI_THINKING_LEVEL: ChatThinkingLevel = "minimal";
/**
 * Também `minimal` nas perguntas técnicas: o 3.5 Flash-Lite em `low` chegou a devolver
 * resposta vazia (o raciocínio come o limite de saída). A precisão vem das fichas no prompt.
 */
export const CHAT_GEMINI_EXPERT_THINKING_LEVEL: ChatThinkingLevel = "minimal";

/**
 * Teto de saída do chat (~400 tokens: duas a quatro frases e, no máximo, uma lista curta).
 * Nos Gemini 3.x o raciocínio conta neste limite, por isso o `minimal`.
 */
export const CHAT_GEMINI_MAX_OUTPUT_TOKENS = 400;
/** Continuação de resposta cortada: uma única, curta, para não estourar o orçamento. */
export const CHAT_GEMINI_RETRY_OUTPUT_TOKENS = 160;

/** Prazo por modelo: com a cadeia de 3 tentativas, o pior caso fica abaixo do maxDuration da rota. */
export const CHAT_GEMINI_TIMEOUT_MS = 9_000;

export const CHAT_GEMINI_MODELS = [CHAT_GEMINI_MODEL, CHAT_GEMINI_FALLBACK_MODEL] as const;

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export const CRIAR_LEAD_DECLARATION = {
  name: "criar_lead",
  description:
    "Registra um lead quando o visitante demonstrou interesse real de compra e informou nome e telefone. Use só nome e telefone — nunca CPF, dados bancários ou outro dado sensível.",
  parameters: {
    type: "object",
    properties: {
      nome: {
        type: "string",
        description: "Nome completo dito pelo visitante.",
      },
      telefone: {
        type: "string",
        description: "Telefone/WhatsApp com DDD dito pelo visitante.",
      },
      veiculo_interesse: {
        type: "string",
        description:
          "Veículo da lista de estoque que a pessoa quer, se houver.",
      },
      mensagem: {
        type: "string",
        description:
          "Resumo curto do interesse no estoque. Sem CPF, banco, PIX ou dado sensível.",
      },
    },
    required: ["nome", "telefone"],
  },
} as const;

type GeminiPart = {
  text?: string;
  thought?: boolean;
  /** Gemini 3.x: assinatura de raciocínio. Volta exatamente como veio, na mesma parte. */
  thoughtSignature?: string;
  functionCall?: { name?: string; args?: unknown };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

type GeminiContent = {
  role?: string;
  parts?: GeminiPart[];
};

export type GeminiFunctionCall = {
  name: string;
  args: unknown;
};

export function normalizeGeminiKey(raw: string) {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(
      /^(GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|GOOGLE_API_KEY)\s*=\s*/i,
      "",
    )
    .trim();
}

export function geminiApiKey() {
  return normalizeGeminiKey(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "",
  );
}

export function geminiConfigured() {
  return Boolean(geminiApiKey());
}

export function redactGeminiError(text: string) {
  return text
    .replace(/key=[^&\s"]+/gi, "key=redacted")
    .replace(/\bAIza[0-9A-Za-z_-]{8,}/g, "redacted")
    .slice(0, 200);
}

export function isCheapChatModel(model: string) {
  const id = model.toLowerCase();
  if (/\bpro\b/.test(id)) return false;
  return /flash-lite|flash-latest|gemini-2\.[05]-flash$/.test(id);
}

function isGemini3(model: string) {
  return /^(?:models\/)?gemini-3/i.test(model);
}

/**
 * Modelos do Gemini, em ordem: GEMINI_MODEL (padrão 3.5 Flash-Lite) e GEMINI_FALLBACK_MODEL
 * (padrão 2.5 Flash-Lite). Modelo mais caro no env nunca vai na frente: entra por último.
 */
export function configuredModels(env: Record<string, string | undefined> = process.env) {
  const clean = (value?: string) => value?.trim().replace(/^models\//, "") ?? "";
  const primary = clean(env.GEMINI_MODEL) || CHAT_GEMINI_MODEL;
  const fallback = clean(env.GEMINI_FALLBACK_MODEL) || CHAT_GEMINI_FALLBACK_MODEL;
  if (!isCheapChatModel(primary)) {
    return [...new Set([CHAT_GEMINI_MODEL, fallback, primary])];
  }
  return [...new Set([primary, fallback])];
}

/** Fila real: Lite primeiro. Modelo mais caro no env só entra como fallback. */
export function chatGeminiModels() {
  return configuredModels();
}

/** Modelo que respondeu 404/403 (sem acesso ou aposentado): pula por um tempo e poupa a ida e volta. */
const MODEL_DOWN_MS = 10 * 60 * 1000;
const modelDownUntil = new Map<string, number>();

export function markChatModelDown(model: string, now = Date.now()) {
  modelDownUntil.set(model, now + MODEL_DOWN_MS);
}

export function resetChatModelHealth() {
  modelDownUntil.clear();
}

function modelsToTry(env: Record<string, string | undefined> = process.env) {
  const all = configuredModels(env);
  const now = Date.now();
  const up = all.filter((model) => (modelDownUntil.get(model) ?? 0) <= now);
  return up.length ? up : all;
}

/** 404 = modelo inexistente/aposentado; 403 = chave sem acesso a este modelo. */
function isModelUnavailable(status: number | undefined) {
  return status === 404 || status === 403;
}

export function chatThinkingLevel(
  env: Record<string, string | undefined> = process.env,
): ChatThinkingLevel {
  const raw = env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
  return raw === "minimal" || raw === "low" || raw === "medium" || raw === "high"
    ? raw
    : CHAT_GEMINI_THINKING_LEVEL;
}

export function generationConfig(
  maxOutputTokens: number,
  temperature: number,
  model = CHAT_GEMINI_MODEL,
  thinkingLevel: ChatThinkingLevel = chatThinkingLevel(),
) {
  const config: Record<string, unknown> = { maxOutputTokens };
  if (isGemini3(model)) {
    // 3.x: thinkingLevel no lugar de thinkingBudget, e sem temperature (padrão 1.0).
    config.thinkingConfig = { thinkingLevel };
    return config;
  }
  config.temperature = temperature;
  // 2.5 Flash/Flash-Lite: evita token extra de raciocínio.
  if (/gemini-2\.5/.test(model)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return config;
}

export function historyToGeminiContents(history: ChatTurn[], mensagem: string) {
  const contents: GeminiContent[] = [];
  for (const turn of history.slice(-12)) {
    const text = turn.content.trim();
    if (!text) continue;
    contents.push({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text }],
    });
  }
  contents.push({ role: "user", parts: [{ text: mensagem }] });
  return contents;
}

export function extractGeminiText(
  data: unknown,
  opts: { trim?: boolean } = {},
) {
  if (!data || typeof data !== "object") return "";
  const candidates = (
    data as { candidates?: Array<{ content?: GeminiContent }> }
  ).candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => (typeof part.text === "string" && !part.thought ? part.text : ""))
    .join("");
  return opts.trim === false ? text : text.trim();
}

export function extractGeminiFinishReason(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const reason = (data as { candidates?: Array<{ finishReason?: string }> })
    .candidates?.[0]?.finishReason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

export type GeminiGenerateResult = {
  text: string;
  functionCall: GeminiFunctionCall | null;
  raw?: unknown;
  finishReason?: string | null;
  truncated?: boolean;
  retried?: boolean;
  model?: string;
  /** Pedidos feitos ao Gemini nesta resposta (1 = sem repetição). */
  calls?: number;
};

export type ChatGenerateInput = {
  systemPrompt: string;
  history: ChatTurn[];
  mensagem: string;
  signal?: AbortSignal;
  /** Perguntas técnicas pedem um pouco mais de raciocínio nos Gemini 3.x. */
  thinkingLevel?: ChatThinkingLevel;
};

/**
 * Junta as partes de todos os quadros do stream na ordem. Preserva a parte do
 * functionCall com a sua thoughtSignature, que o Gemini 3.x exige de volta.
 */
export function collectGeminiParts(frames: unknown[]): GeminiPart[] {
  const parts: GeminiPart[] = [];
  for (const frame of frames) {
    const content = (
      frame as { candidates?: Array<{ content?: GeminiContent }> } | null
    )?.candidates?.[0]?.content;
    for (const part of content?.parts ?? []) {
      if (part && typeof part === "object") parts.push(part);
    }
  }
  return parts;
}

/** Resposta completa do modelo no formato de `generateContent`, montada a partir do stream. */
export function geminiRawFromParts(parts: GeminiPart[], finishReason: string | null) {
  return {
    candidates: [
      {
        content: { role: "model", parts },
        ...(finishReason ? { finishReason } : {}),
      },
    ],
  };
}

export function extractGeminiFunctionCall(
  data: unknown,
): GeminiFunctionCall | null {
  if (!data || typeof data !== "object") return null;
  const candidates = (
    data as { candidates?: Array<{ content?: GeminiContent }> }
  ).candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const name = part.functionCall?.name?.trim();
    if (name) {
      return { name, args: part.functionCall?.args ?? {} };
    }
  }
  return null;
}

function endpoint(model: string, stream = false) {
  return stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

async function postGemini(
  body: unknown,
  key: string,
  model: string,
  signal?: AbortSignal,
  timeoutMs = CHAT_GEMINI_TIMEOUT_MS,
) {
  const response = await fetch(endpoint(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const message =
      typeof data.error === "object" && data.error && "message" in data.error
        ? String((data.error as { message?: string }).message)
        : `gemini ${response.status}`;
    const error = new Error(redactGeminiError(message)) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return data;
}

/** Grounding: 3.5 primeiro, 2.5 como reserva apenas para endpoint rejeitado.
 * Prazo de 4 s por modelo; autenticação, cota e erro de servidor encerram a pesquisa.
 */
export async function generateGroundedResearch(
  prompt: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const key = geminiApiKey();
  if (!key) throw new Error("Pesquisa técnica indisponível");
  const models = [CHAT_GEMINI_MODEL, CHAT_GEMINI_FALLBACK_MODEL];
  let lastError: unknown;
  for (const model of models) {
    signal?.throwIfAborted();
    try {
      return await postGemini(
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: generationConfig(1200, 0.1, model, "minimal"),
        },
        key,
        model,
        signal,
        4_000,
      );
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error;
      const status = (error as {status?: number}).status;
      if (status !== 400 && status !== 404) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Pesquisa técnica indisponível");
}

function buildGenerateBody(
  input: ChatGenerateInput,
  withTools: boolean,
  model: string,
  maxOutputTokens = CHAT_GEMINI_MAX_OUTPUT_TOKENS,
) {
  return {
    system_instruction: { parts: [{ text: input.systemPrompt }] },
    contents: historyToGeminiContents(input.history, input.mensagem),
    ...(withTools
      ? { tools: [{ function_declarations: [CRIAR_LEAD_DECLARATION] }] }
      : {}),
    generationConfig: generationConfig(
      maxOutputTokens,
      CHAT_GEMINI_TEMPERATURE,
      model,
      input.thinkingLevel,
    ),
  };
}

/** Resposta sem texto e sem chamada de função: nunca chega ao visitante, passa ao próximo modelo. */
export class EmptyReplyError extends Error {
  constructor(public readonly model: string) {
    super("resposta vazia");
    this.name = "EmptyReplyError";
  }
}

export type ChatProvider = { kind: "gemini"; model: string } | { kind: "openrouter" };

/** Só para teste: força a reserva em previews. Em produção a variável é ignorada. */
export function forcedChatFallback(
  env: Record<string, string | undefined> = process.env,
): "openrouter" | "gemini-fallback" | null {
  if (env.VERCEL_ENV === "production") return null;
  const value = env.CHAT_FORCE_FALLBACK?.trim().toLowerCase();
  return value === "openrouter" || value === "gemini-fallback" ? value : null;
}

/**
 * Ordem das tentativas: Gemini 3.5 Flash-Lite, Gemini 2.5 Flash-Lite e, só se os dois
 * falharem, DeepSeek via OpenRouter (se houver OPENROUTER_API_KEY).
 */
export function chatProviders(
  env: Record<string, string | undefined> = process.env,
): ChatProvider[] {
  const forced = forcedChatFallback(env);
  const openrouter: ChatProvider[] = openRouterConfigured(env) ? [{ kind: "openrouter" }] : [];
  if (forced === "openrouter") return openrouter;
  const hasKey = Boolean(geminiApiKey());
  let models = hasKey ? modelsToTry(env) : [];
  if (forced === "gemini-fallback" && models.length > 1) models = models.slice(1);
  return [...models.map((model): ChatProvider => ({ kind: "gemini", model })), ...openrouter];
}

type ChainTally = { calls: number };

/** Um modelo do Gemini: stream ou não, com a continuação curta se a resposta vier cortada. */
async function runGeminiModel(
  input: ChatGenerateInput,
  key: string,
  model: string,
  opts: { stream: boolean; onToken?: (delta: string) => void; tally: ChainTally },
): Promise<GeminiGenerateResult> {
  const toolFlags = chatTurnMayCreateLead(input.mensagem, input.history) ? [true, false] : [false];
  let lastError: unknown;
  for (const [index, withTools] of toolFlags.entries()) {
    const body = buildGenerateBody(input, withTools, model);
    let text = "";
    let functionCall: GeminiFunctionCall | null = null;
    let finishReason: string | null = null;
    let interrupted = false;
    const frames: unknown[] = [];
    try {
      opts.tally.calls += 1;
      const source: AsyncIterable<unknown> = opts.stream
        ? streamGemini(body, key, model, input.signal)
        : (async function* () {
            yield await postGemini(body, key, model, input.signal);
          })();
      try {
        for await (const frame of source) {
          frames.push(frame);
          const delta = extractGeminiText(frame, { trim: false });
          const call = extractGeminiFunctionCall(frame);
          finishReason = extractGeminiFinishReason(frame) ?? finishReason;
          if (call) functionCall = call;
          if (delta) {
            text += delta;
            if (!functionCall) opts.onToken?.(delta);
          }
        }
      } catch (error) {
        input.signal?.throwIfAborted();
        // Stream que cai no meio: o que já foi mostrado fica, fechado na última frase.
        if (!text.trim() || functionCall) throw error;
        interrupted = true;
        finishReason = finishReason ?? "INTERRUPTED";
      }
      if (!functionCall && !text.trim()) throw new EmptyReplyError(model);
      // Todas as partes (com a thoughtSignature do functionCall) para devolver ao modelo.
      const raw = geminiRawFromParts(collectGeminiParts(frames), finishReason);
      let retried = false;
      if (!functionCall && !interrupted && looksTruncated(text, finishReason)) {
        try {
          opts.tally.calls += 1;
          const extra = await continueTruncatedReply(input, text, key, model);
          if (extra) {
            const merged = mergeContinuation(text, extra);
            const piece = merged.slice(text.length);
            text = merged;
            if (piece) opts.onToken?.(piece);
            retried = true;
            finishReason = "STOP";
          }
        } catch (error) {
          input.signal?.throwIfAborted();
          console.info(
            "[chat] gemini:continuation_failed",
            { status: (error as { status?: number }).status ?? null },
          );
        }
      }
      const closed = finalizeGeneratedText(text, finishReason, retried);
      if (closed.text.startsWith(text) && closed.text.length > text.length) {
        const piece = closed.text.slice(text.length);
        if (piece) opts.onToken?.(piece);
      }
      return {
        text: closed.text,
        functionCall,
        raw,
        finishReason,
        truncated: closed.truncated,
        retried: closed.retried,
        model,
      };
    } catch (error) {
      input.signal?.throwIfAborted();
      lastError = error;
      // 400 com ferramenta: tenta o mesmo modelo sem a ferramenta.
      const status = (error as { status?: number }).status;
      if (status === 400 && index < toolFlags.length - 1) continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("gemini failed");
}

/** DeepSeek via OpenRouter: mesmo prompt e contexto, sem stream (o texto sai inteiro de uma vez). */
async function runOpenRouter(
  input: ChatGenerateInput,
  opts: { onToken?: (delta: string) => void; tally: ChainTally },
): Promise<GeminiGenerateResult> {
  // criar_lead entra como ferramenta; a confirmação depois do lead é a frase fixa do chat-turn
  // (o modelo não recebe o resultado da ferramenta como no Gemini).
  const mayCreateLead = chatTurnMayCreateLead(input.mensagem, input.history);
  opts.tally.calls += 1;
  const reply = await generateOpenRouterReply({
    systemPrompt: input.systemPrompt,
    history: input.history.slice(-12).filter((turn) => turn.content.trim()),
    mensagem: input.mensagem,
    signal: input.signal,
    tool: mayCreateLead ? CRIAR_LEAD_DECLARATION : null,
  });
  if (!reply.functionCall && !reply.text) throw new EmptyReplyError(reply.model);
  const closed = finalizeGeneratedText(reply.text, reply.finishReason, false);
  if (closed.text && !reply.functionCall) opts.onToken?.(closed.text);
  return {
    text: closed.text,
    functionCall: reply.functionCall,
    finishReason: reply.finishReason,
    truncated: closed.truncated,
    retried: false,
    model: reply.model,
  };
}

/**
 * Cadeia de modelos. Qualquer falha (erro, 404/403, cota, créditos, timeout, resposta vazia)
 * passa ao próximo; a chave inválida (401) pula o resto do Gemini. Só aborto do visitante sobe.
 */
async function runChain(
  input: ChatGenerateInput,
  opts: { stream: boolean; onToken?: (delta: string) => void },
): Promise<GeminiGenerateResult> {
  input.signal?.throwIfAborted();
  const providers = chatProviders();
  if (!providers.length) {
    console.error("[chat] gemini: missing_key");
    return { text: CHAT_FALLBACK_REPLY, functionCall: null };
  }
  const key = geminiApiKey();
  const tally: ChainTally = { calls: 0 };
  let lastError: unknown;
  let skipGemini = false;
  for (const provider of providers) {
    input.signal?.throwIfAborted();
    if (provider.kind === "gemini" && skipGemini) continue;
    try {
      const result =
        provider.kind === "gemini"
          ? await runGeminiModel(input, key, provider.model, { ...opts, tally })
          : await runOpenRouter(input, { onToken: opts.onToken, tally });
      return { ...result, calls: tally.calls };
    } catch (error) {
      input.signal?.throwIfAborted();
      lastError = error;
      const status = (error as { status?: number }).status;
      const name = provider.kind === "gemini" ? provider.model : "openrouter";
      if (provider.kind === "gemini") {
        if (status === 401) skipGemini = true;
        if (isModelUnavailable(status)) markChatModelDown(provider.model);
      }
      // Só tipo, status e modelo: nada de chave, prompt ou mensagem do visitante.
      console.warn("[chat] model_failed", {
        model: name,
        status: typeof status === "number" ? status : undefined,
        reason:
          error instanceof EmptyReplyError
            ? "empty"
            : error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
              ? "timeout"
              : "error",
        ...(provider.kind === "gemini" && isModelUnavailable(status)
          ? { message: redactGeminiError(error instanceof Error ? error.message : "err") }
          : {}),
      });
    }
  }
  console.error("[chat] todos os modelos falharam");
  throw lastError instanceof Error ? lastError : new Error("gemini failed");
}

async function continueTruncatedReply(
  input: ChatGenerateInput,
  partial: string,
  key: string,
  model: string,
) {
  const contents = historyToGeminiContents(input.history, input.mensagem);
  contents.push({ role: "model", parts: [{ text: partial }] });
  contents.push({
    role: "user",
    parts: [
      {
        text: "Continue a resposta de onde parou, sem repetir o que já escreveu, e feche com uma frase curta em português do Brasil.",
      },
    ],
  });
  const data = await postGemini(
    {
      system_instruction: { parts: [{ text: input.systemPrompt }] },
      contents,
      generationConfig: generationConfig(
        CHAT_GEMINI_RETRY_OUTPUT_TOKENS,
        0.3,
        model,
        input.thinkingLevel,
      ),
    },
    key,
    model,
    input.signal,
  );
  return extractGeminiText(data);
}

function finalizeGeneratedText(
  text: string,
  finishReason: string | null,
  retried: boolean,
): Pick<GeminiGenerateResult, "text" | "truncated" | "retried"> {
  const truncated = looksTruncated(text, finishReason);
  if (!truncated) return { text, truncated: false, retried };
  // Resposta cortada nunca chega ao visitante no meio da frase.
  return {
    text: closeTruncatedReply(text),
    truncated: true,
    retried,
  };
}

export async function generateChatReply(
  input: ChatGenerateInput,
): Promise<GeminiGenerateResult> {
  return runChain(input, { stream: false });
}

function parseSseJsonFrames(buffer: string): {
  frames: unknown[];
  rest: string;
} {
  return parseJsonSseFrames(buffer);
}

async function* streamGemini(
  body: unknown,
  key: string,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<unknown> {
  const response = await fetch(endpoint(model, true), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(CHAT_GEMINI_TIMEOUT_MS)])
      : AbortSignal.timeout(CHAT_GEMINI_TIMEOUT_MS),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const message =
      typeof data.error === "object" && data.error && "message" in data.error
        ? String((data.error as { message?: string }).message)
        : `gemini ${response.status}`;
    const error = new Error(redactGeminiError(message)) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("gemini stream empty");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    if (done) {
      buffer += decoder.decode();
      const parsed = parseSseJsonFrames(buffer);
      for (const frame of parsed.frames) yield frame;
      for (const frame of drainJsonSseBuffer(parsed.rest)) yield frame;
      break;
    }
    const parsed = parseSseJsonFrames(buffer);
    buffer = parsed.rest;
    for (const frame of parsed.frames) yield frame;
  }
}

export async function generateChatReplyStream(
  input: ChatGenerateInput,
  opts: { onToken?: (delta: string) => void } = {},
): Promise<GeminiGenerateResult> {
  return runChain(input, { stream: true, onToken: opts.onToken });
}

export async function confirmAfterLead(input: {
  systemPrompt: string;
  history: ChatTurn[];
  mensagem: string;
  signal?: AbortSignal;
  /** Resposta completa do modelo com o functionCall (e a thoughtSignature, no Gemini 3.x). */
  modelContent: unknown;
  functionName: string;
  functionResult: Record<string, unknown>;
  /** Modelo que gerou o functionCall: a assinatura só vale para ele. */
  model?: string;
}) {
  input.signal?.throwIfAborted();
  const key = geminiApiKey();
  if (!key) return CHAT_FALLBACK_REPLY;
  // Lead criado por outro provedor (DeepSeek): não há assinatura nem turno de função do Gemini
  // para devolver. Vazio faz o chat usar a frase fixa de confirmação.
  if (input.model && !/^(?:models\/)?gemini-/i.test(input.model)) return "";

  const model = input.model ?? configuredModels()[0] ?? CHAT_GEMINI_MODEL;
  const contents = historyToGeminiContents(input.history, input.mensagem);
  const modelParts =
    input.modelContent && typeof input.modelContent === "object"
      ? (
          input.modelContent as {
            candidates?: Array<{ content?: GeminiContent }>;
          }
        ).candidates?.[0]?.content
      : null;
  if (modelParts) contents.push({ role: "model", ...modelParts });
  contents.push({
    role: "user",
    parts: [
      {
        functionResponse: {
          name: input.functionName,
          response: input.functionResult,
        },
      },
    ],
  });

  const data = await postGemini(
    {
      system_instruction: { parts: [{ text: input.systemPrompt }] },
      contents,
      tools: [{ function_declarations: [CRIAR_LEAD_DECLARATION] }],
      generationConfig: generationConfig(280, 0.3, model, "minimal"),
    },
    key,
    model,
    input.signal,
  );
  return extractGeminiText(data);
}
