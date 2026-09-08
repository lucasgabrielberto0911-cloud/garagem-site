import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";

export const CHAT_GEMINI_MODEL = "gemini-2.5-flash";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export const CRIAR_LEAD_DECLARATION = {
  name: "criar_lead",
  description:
    "Registra um lead quando o visitante demonstrou interesse real de compra e informou nome e telefone. Use só nome e telefone — nunca CPF, dados bancários ou outro dado sensível.",
  parameters: {
    type: "OBJECT",
    properties: {
      nome: { type: "STRING", description: "Nome completo dito pelo visitante." },
      telefone: {
        type: "STRING",
        description: "Telefone/WhatsApp com DDD dito pelo visitante.",
      },
      veiculo_interesse: {
        type: "STRING",
        description: "Veículo da lista de estoque que a pessoa quer, se houver.",
      },
      mensagem: {
        type: "STRING",
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

export function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
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

function endpoint(model: string, key: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
}

async function postGemini(body: unknown, key: string, model = CHAT_GEMINI_MODEL) {
  const response = await fetch(endpoint(model, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof data.error === "object" && data.error && "message" in data.error
        ? String((data.error as { message?: string }).message)
        : `gemini ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function generateChatReply(input: {
  systemPrompt: string;
  history: ChatTurn[];
  mensagem: string;
}) {
  const key = geminiApiKey();
  if (!key) {
    return { text: CHAT_FALLBACK_REPLY, functionCall: null as GeminiFunctionCall | null };
  }

  const body = {
    system_instruction: { parts: [{ text: input.systemPrompt }] },
    contents: historyToGeminiContents(input.history, input.mensagem),
    tools: [{ function_declarations: [CRIAR_LEAD_DECLARATION] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 512,
    },
  };

  const data = await postGemini(body, key);
  return {
    text: extractGeminiText(data),
    functionCall: extractGeminiFunctionCall(data),
    raw: data,
  };
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
      generationConfig: { temperature: 0.3, maxOutputTokens: 280 },
    },
    key,
  );
  return extractGeminiText(data);
}
