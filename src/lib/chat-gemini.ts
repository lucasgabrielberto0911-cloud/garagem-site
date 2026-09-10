import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import {
  looksTruncated,
  mergeContinuation,
  closeTruncatedReply,
} from "@/lib/chat-polish";

/** Mais barato e rápido para chat de loja. Flash entra só se o Lite falhar. */
export const CHAT_GEMINI_MODEL = "gemini-2.5-flash-lite";

/** Um pouco mais solto que o padrão seco — ainda profissional. */
export const CHAT_GEMINI_TEMPERATURE = 0.7;

/** Cabe lista + comparação sem cortar frase no meio. */
export const CHAT_GEMINI_MAX_OUTPUT_TOKENS = 2048;
export const CHAT_GEMINI_RETRY_OUTPUT_TOKENS = 3072;

export const CHAT_GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
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
      nome: { type: "string", description: "Nome completo dito pelo visitante." },
      telefone: {
        type: "string",
        description: "Telefone/WhatsApp com DDD dito pelo visitante.",
      },
      veiculo_interesse: {
        type: "string",
        description: "Veículo da lista de estoque que a pessoa quer, se houver.",
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

function isCheapChatModel(model: string) {
  const id = model.toLowerCase();
  if (/\bpro\b/.test(id)) return false;
  return /flash-lite|flash-latest|gemini-2\.[05]-flash$/.test(id);
}

function configuredModels() {
  const preferred = process.env.GEMINI_MODEL?.trim();
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

function generationConfig(
  maxOutputTokens: number,
  temperature: number,
  model = CHAT_GEMINI_MODEL,
) {
  const config: Record<string, unknown> = {
    temperature,
    maxOutputTokens,
  };
  // Flash-Lite já vem sem thinking; no Flash 2.5/3 isso evita token extra de raciocínio.
  if (/gemini-(2\.5|3)/.test(model)) {
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

export function extractGeminiText(data: unknown, opts: { trim?: boolean } = {}) {
  if (!data || typeof data !== "object") return "";
  const candidates = (data as { candidates?: Array<{ content?: GeminiContent }> })
    .candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
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
};

export function extractGeminiFunctionCall(data: unknown): GeminiFunctionCall | null {
  if (!data || typeof data !== "object") return null;
  const candidates = (data as { candidates?: Array<{ content?: GeminiContent }> })
    .candidates;
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

async function postGemini(body: unknown, key: string, model: string) {
  const response = await fetch(endpoint(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
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

function buildGenerateBody(
  input: {
    systemPrompt: string;
    history: ChatTurn[];
    mensagem: string;
  },
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
    ),
  };
}

async function generateWithFallback(
  input: {
    systemPrompt: string;
    history: ChatTurn[];
    mensagem: string;
  },
  key: string,
) {
  let lastError: unknown;
  for (const model of configuredModels()) {
    for (const withTools of [true, false]) {
      try {
        const data = await postGemini(
          buildGenerateBody(input, withTools, model),
          key,
          model,
        );
        console.info("[chat] gemini:model", model);
        return { data, model };
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) throw error;
        if (status !== 400 && status !== 404) throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("gemini failed");
}

async function continueTruncatedReply(
  input: {
    systemPrompt: string;
    history: ChatTurn[];
    mensagem: string;
  },
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
      ),
    },
    key,
    model,
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

export async function generateChatReply(input: {
  systemPrompt: string;
  history: ChatTurn[];
  mensagem: string;
}): Promise<GeminiGenerateResult> {
  const key = geminiApiKey();
  if (!key) {
    console.error("[chat] gemini: missing_key");
    return { text: CHAT_FALLBACK_REPLY, functionCall: null };
  }

  try {
    const { data, model } = await generateWithFallback(input, key);
    let text = extractGeminiText(data);
    const functionCall = extractGeminiFunctionCall(data);
    let finishReason = extractGeminiFinishReason(data);
    let retried = false;
    if (!functionCall && looksTruncated(text, finishReason)) {
      try {
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
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : "gemini failed";
    console.error("[chat] gemini:", status ?? "err", redactGeminiError(message));
    throw error;
  }
}

function parseSseJsonFrames(buffer: string): { frames: unknown[]; rest: string } {
  const frames: unknown[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const line = part
      .split("\n")
      .find((row) => row.startsWith("data:"));
    if (!line) continue;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") continue;
    try {
      frames.push(JSON.parse(raw));
    } catch {
      // chunk incompleto — fica para o próximo read
    }
  }
  return { frames, rest };
}

async function* streamGemini(
  body: unknown,
  key: string,
  model: string,
): AsyncGenerator<unknown> {
  const response = await fetch(endpoint(model, true), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
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
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseJsonFrames(buffer);
    buffer = parsed.rest;
    for (const frame of parsed.frames) yield frame;
  }
  if (buffer.trim()) {
    const parsed = parseSseJsonFrames(`${buffer}\n\n`);
    for (const frame of parsed.frames) yield frame;
  }
}

export async function generateChatReplyStream(
  input: {
    systemPrompt: string;
    history: ChatTurn[];
    mensagem: string;
  },
  opts: { onToken?: (delta: string) => void } = {},
): Promise<GeminiGenerateResult> {
  const key = geminiApiKey();
  if (!key) {
    console.error("[chat] gemini: missing_key");
    return { text: CHAT_FALLBACK_REPLY, functionCall: null };
  }

  let lastError: unknown;
  for (const model of configuredModels()) {
    for (const withTools of [true, false]) {
      try {
        let text = "";
        let functionCall: GeminiFunctionCall | null = null;
        let finishReason: string | null = null;
        let lastRaw: unknown;
        for await (const frame of streamGemini(
          buildGenerateBody(input, withTools, model),
          key,
          model,
        )) {
          lastRaw = frame;
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
        let retried = false;
        if (!functionCall && looksTruncated(text, finishReason)) {
          try {
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
        const closed = finalizeGeneratedText(text, finishReason, retried);
        return {
          text: closed.text,
          functionCall,
          raw: lastRaw,
          finishReason,
          truncated: closed.truncated,
          retried: closed.retried,
          model,
        };
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) throw error;
        if (status !== 400 && status !== 404) break;
      }
    }
  }

  try {
    const fallback = await generateChatReply(input);
    if (fallback.text && !fallback.functionCall) {
      opts.onToken?.(fallback.text);
    }
    return fallback;
  } catch {
    throw lastError instanceof Error ? lastError : new Error("gemini failed");
  }
}

export async function confirmAfterLead(input: {
  systemPrompt: string;
  history: ChatTurn[];
  mensagem: string;
  modelContent: unknown;
  functionName: string;
  functionResult: Record<string, unknown>;
}) {
  const key = geminiApiKey();
  if (!key) return CHAT_FALLBACK_REPLY;

  const contents = historyToGeminiContents(input.history, input.mensagem);
  const modelParts =
    input.modelContent && typeof input.modelContent === "object"
      ? (input.modelContent as { candidates?: Array<{ content?: GeminiContent }> })
          .candidates?.[0]?.content
      : null;
  if (modelParts) contents.push(modelParts);
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
      generationConfig: generationConfig(
        280,
        0.3,
        configuredModels()[0] ?? CHAT_GEMINI_MODEL,
      ),
    },
    key,
    configuredModels()[0] ?? CHAT_GEMINI_MODEL,
  );
  return extractGeminiText(data);
}
