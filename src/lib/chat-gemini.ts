import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import { chatTurnMayCreateLead } from "@/lib/chat-guard";
import {
  looksTruncated,
  mergeContinuation,
  closeTruncatedReply,
  streamTextNeedsRegen,
} from "@/lib/chat-polish";
import { drainJsonSseBuffer, parseJsonSseFrames } from "@/lib/chat-stream";

/** Padrão do chat: Gemini 3.5 Flash-Lite (GA), barato e rápido. Muda por GEMINI_MODEL. */
export const CHAT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Se a chave não tiver acesso ao 3.5 (404/403 de modelo), o chat segue neste. */
export const CHAT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";

/** Só vale para 2.x. Nos Gemini 3.x a temperatura fica no padrão (1.0): a doc avisa que mexer piora. */
export const CHAT_GEMINI_TEMPERATURE = 0.7;

/**
 * Nível de raciocínio dos Gemini 3.x. `minimal` é o padrão do 3.5 Flash-Lite e o
 * que mantém a latência de chat; perguntas técnicas sobem para `low` (ver chat-turn).
 */
export type ChatThinkingLevel = "minimal" | "low" | "medium" | "high";
export const CHAT_GEMINI_THINKING_LEVEL: ChatThinkingLevel = "minimal";
export const CHAT_GEMINI_EXPERT_THINKING_LEVEL: ChatThinkingLevel = "low";

/** Cabe lista + comparação sem cortar frase no meio. */
export const CHAT_GEMINI_MAX_OUTPUT_TOKENS = 2048;
export const CHAT_GEMINI_RETRY_OUTPUT_TOKENS = 3072;

export const CHAT_GEMINI_MODELS = [
  CHAT_GEMINI_MODEL,
  CHAT_GEMINI_FALLBACK_MODEL,
  "gemini-2.5-flash",
] as const;

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

export function configuredModels(env: Record<string, string | undefined> = process.env) {
  const preferred = env.GEMINI_MODEL?.trim().replace(/^models\//, "");
  if (!preferred) return [...CHAT_GEMINI_MODELS];
  if (isCheapChatModel(preferred)) {
    return [...new Set([preferred, ...CHAT_GEMINI_MODELS])];
  }
  return [...new Set([...CHAT_GEMINI_MODELS, preferred])];
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

function modelsToTry() {
  const all = configuredModels();
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
) {
  const response = await fetch(endpoint(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000),
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

/** Grounded calls only. A rejected/retired endpoint can try one already
 * configured 2.5 model; auth, quota and server errors never fan out calls.
 */
export async function generateGroundedResearch(
  prompt: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const key = geminiApiKey();
  if (!key) throw new Error("Pesquisa técnica indisponível");
  const models = configuredModels().filter(name => /^gemini-(?:2\.5|3)/.test(name)).slice(0, 2);
  let lastError: unknown;
  for (const model of models.length ? models : [CHAT_GEMINI_MODEL]) {
    signal?.throwIfAborted();
    try {
      return await postGemini(
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: generationConfig(2048, 0.1, model, "low"),
        },
        key,
        model,
        signal,
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

function logModelFallback(model: string, error: unknown) {
  const status = (error as { status?: number }).status;
  console.warn("[chat] gemini:model_unavailable", {
    model,
    status: typeof status === "number" ? status : undefined,
    message: redactGeminiError(error instanceof Error ? error.message : "err"),
  });
}

async function generateWithFallback(input: ChatGenerateInput, key: string) {
  let lastError: unknown;
  let calls = 0;
  const toolFlags = chatTurnMayCreateLead(input.mensagem, input.history)
    ? [true, false]
    : [false];
  const models = modelsToTry();
  for (const [index, model] of models.entries()) {
    input.signal?.throwIfAborted();
    for (const withTools of toolFlags) {
      try {
        calls += 1;
        const data = await postGemini(
          buildGenerateBody(input, withTools, model),
          key,
          model,
          input.signal,
        );
        console.info("[chat] gemini:model", model);
        return { data, model, calls };
      } catch (error) {
        input.signal?.throwIfAborted();
        lastError = error;
        const status = (error as { status?: number }).status;
        if (status === 401) throw error;
        if (isModelUnavailable(status)) {
          // Sem acesso a este modelo (ou aposentado): lembra e passa ao próximo.
          markChatModelDown(model);
          logModelFallback(model, error);
          if (index === models.length - 1) throw error;
          break;
        }
        if (status !== 400) throw error;
      }
    }
  }
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
        text: "Continue a resposta de onde parou, sem repetir o que já escreveu. Feche as frases em português do Brasil.",
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
  return {
    text: closeTruncatedReply(text),
    truncated: true,
    retried,
  };
}

export async function generateChatReply(
  input: ChatGenerateInput,
): Promise<GeminiGenerateResult> {
  input.signal?.throwIfAborted();
  const key = geminiApiKey();
  if (!key) {
    console.error("[chat] gemini: missing_key");
    return { text: CHAT_FALLBACK_REPLY, functionCall: null };
  }

  try {
    const { data, model, calls: firstCalls } = await generateWithFallback(input, key);
    let calls = firstCalls;
    let text = extractGeminiText(data);
    const functionCall = extractGeminiFunctionCall(data);
    let finishReason = extractGeminiFinishReason(data);
    let retried = false;
    if (!functionCall && looksTruncated(text, finishReason)) {
      try {
        calls += 1;
        const extra = await continueTruncatedReply(input, text, key, model);
        if (extra) {
          text = mergeContinuation(text, extra);
          retried = true;
          finishReason = "STOP";
        }
      } catch (error) {
        console.info(
          "[chat] gemini:continuation_failed",
          redactGeminiError(error instanceof Error ? error.message : "err"),
        );
      }
    }
    const closed = finalizeGeneratedText(text, finishReason, retried);
    return {
      text: closed.text,
      functionCall,
      raw: data,
      finishReason,
      truncated: closed.truncated,
      retried: closed.retried,
      model,
      calls,
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : "gemini failed";
    console.error(
      "[chat] gemini:",
      status ?? "err",
      redactGeminiError(message),
    );
    throw error;
  }
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
      ? AbortSignal.any([signal, AbortSignal.timeout(25_000)])
      : AbortSignal.timeout(25_000),
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
  input.signal?.throwIfAborted();
  const key = geminiApiKey();
  if (!key) {
    console.error("[chat] gemini: missing_key");
    return { text: CHAT_FALLBACK_REPLY, functionCall: null };
  }

  let lastError: unknown;
  let calls = 0;
  const toolFlags = chatTurnMayCreateLead(input.mensagem, input.history)
    ? [true, false]
    : [false];
  const models = modelsToTry();
  for (const [index, model] of models.entries()) {
    input.signal?.throwIfAborted();
    for (const withTools of toolFlags) {
      try {
        let text = "";
        let functionCall: GeminiFunctionCall | null = null;
        let finishReason: string | null = null;
        const frames: unknown[] = [];
        calls += 1;
        for await (const frame of streamGemini(
          buildGenerateBody(input, withTools, model),
          key,
          model,
          input.signal,
        )) {
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
        console.info("[chat] gemini:model", model);
        // Todas as partes (com a thoughtSignature do functionCall) para devolver ao modelo.
        const raw = geminiRawFromParts(collectGeminiParts(frames), finishReason);
        let retried = false;
        const regen = !functionCall && streamTextNeedsRegen(text, finishReason);
        if (regen) {
          try {
            const full = await generateChatReply(input);
            calls += full.calls ?? 1;
            if (full.text && full.text.trim().length >= text.trim().length) {
              const piece = full.text.startsWith(text)
                ? full.text.slice(text.length)
                : "";
              if (piece) opts.onToken?.(piece);
              return { ...full, retried: true, calls };
            }
          } catch (error) {
            console.info(
              "[chat] gemini:stream_regen_failed",
              redactGeminiError(error instanceof Error ? error.message : "err"),
            );
          }
        }
        if (!functionCall && looksTruncated(text, finishReason)) {
          try {
            calls += 1;
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
            console.info(
              "[chat] gemini:continuation_failed",
              redactGeminiError(error instanceof Error ? error.message : "err"),
            );
          }
        }
        if (!functionCall && looksTruncated(text, finishReason) && !regen) {
          try {
            const full = await generateChatReply(input);
            calls += full.calls ?? 1;
            if (full.text && full.text.trim().length > text.trim().length) {
              const piece = full.text.startsWith(text)
                ? full.text.slice(text.length)
                : "";
              if (piece) opts.onToken?.(piece);
              return { ...full, retried: true, calls };
            }
          } catch (error) {
            console.info(
              "[chat] gemini:stream_regen_failed",
              redactGeminiError(error instanceof Error ? error.message : "err"),
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
          calls,
        };
      } catch (error) {
        input.signal?.throwIfAborted();
        lastError = error;
        const status = (error as { status?: number }).status;
        if (status === 401) throw error;
        if (isModelUnavailable(status)) {
          markChatModelDown(model);
          logModelFallback(model, error);
          if (index === models.length - 1) throw error;
          break;
        }
        if (status !== 400) break;
      }
    }
  }

  try {
    const fallback = await generateChatReply(input);
    if (fallback.text && !fallback.functionCall) {
      opts.onToken?.(fallback.text);
    }
    return { ...fallback, calls: calls + (fallback.calls ?? 1) };
  } catch {
    throw lastError instanceof Error ? lastError : new Error("gemini failed");
  }
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
