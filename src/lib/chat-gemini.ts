import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";

/** Mais barato e rápido para chat de loja. Flash entra só se o Lite falhar. */
export const CHAT_GEMINI_MODEL = "gemini-2.5-flash-lite";

/** Um pouco mais solto que o padrão seco — ainda profissional. */
export const CHAT_GEMINI_TEMPERATURE = 0.7;

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

export function extractGeminiText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const candidates = (data as { candidates?: Array<{ content?: GeminiContent }> })
    .candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

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

function endpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
) {
  return {
    system_instruction: { parts: [{ text: input.systemPrompt }] },
    contents: historyToGeminiContents(input.history, input.mensagem),
    ...(withTools
      ? { tools: [{ function_declarations: [CRIAR_LEAD_DECLARATION] }] }
      : {}),
    generationConfig: generationConfig(1536, CHAT_GEMINI_TEMPERATURE, model),
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
        return data;
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

export async function generateChatReply(input: {
  systemPrompt: string;
  history: ChatTurn[];
  mensagem: string;
}) {
  const key = geminiApiKey();
  if (!key) {
    console.error("[chat] gemini: missing_key");
    return { text: CHAT_FALLBACK_REPLY, functionCall: null as GeminiFunctionCall | null };
  }

  try {
    const data = await generateWithFallback(input, key);
    return {
      text: extractGeminiText(data),
      functionCall: extractGeminiFunctionCall(data),
      raw: data,
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : "gemini failed";
    console.error("[chat] gemini:", status ?? "err", redactGeminiError(message));
    throw error;
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
