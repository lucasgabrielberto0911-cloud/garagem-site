/**
 * Terceira reserva do chat: DeepSeek V4.1 Flash via OpenRouter (formato OpenAI).
 * Só entra quando o Gemini 3.5 e o 2.5 falham (erro, cota/429, créditos ou resposta vazia).
 *
 * Recebe o MESMO system prompt e o contexto completo (ficha em tela, estoque, leitura do Jev,
 * histórico), nunca um resumo. Sem OPENROUTER_API_KEY o módulo não chama a rede.
 * A chave fica só no servidor e nunca é logada.
 */

export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const CHAT_OPENROUTER_MODEL = "deepseek/deepseek-v4.1-flash";
/** Curto de propósito: é a última reserva e o visitante está esperando. */
export const CHAT_OPENROUTER_TIMEOUT_MS = 8_000;
/** Mesmo teto de saída do Gemini. */
export const CHAT_OPENROUTER_MAX_TOKENS = 400;

export type OpenRouterTurn = { role: "user" | "assistant"; content: string };

export type OpenRouterToolDeclaration = {
  name: string;
  description: string;
  parameters: unknown;
};

export type OpenRouterReply = {
  text: string;
  functionCall: { name: string; args: unknown } | null;
  finishReason: string | null;
  model: string;
};

export function openRouterApiKey(env: Record<string, string | undefined> = process.env) {
  return env.OPENROUTER_API_KEY?.trim() ?? "";
}

export function openRouterConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(openRouterApiKey(env));
}

export function openRouterModel(env: Record<string, string | undefined> = process.env) {
  return env.OPENROUTER_MODEL?.trim() || CHAT_OPENROUTER_MODEL;
}

/** Os schemas do Gemini usam tipos em maiúsculas; o formato OpenAI pede minúsculas. */
function lowerCaseTypes(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(lowerCaseTypes);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema as Record<string, unknown>).map(([key, value]) => [
      key,
      key === "type" && typeof value === "string" ? value.toLowerCase() : lowerCaseTypes(value),
    ]),
  );
}

export function buildOpenRouterBody(input: {
  systemPrompt: string;
  history: OpenRouterTurn[];
  mensagem: string;
  model?: string;
  tool?: OpenRouterToolDeclaration | null;
}) {
  return {
    model: input.model ?? openRouterModel(),
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: input.mensagem },
    ],
    max_tokens: CHAT_OPENROUTER_MAX_TOKENS,
    temperature: 0.7,
    // Raciocínio desligado: o chat precisa de latência, não de cadeia de pensamento.
    reasoning: { enabled: false },
    ...(input.tool
      ? {
          tools: [
            {
              type: "function",
              function: {
                name: input.tool.name,
                description: input.tool.description,
                parameters: lowerCaseTypes(input.tool.parameters),
              },
            },
          ],
        }
      : {}),
  };
}

function parseToolArgs(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

export function parseOpenRouterReply(data: unknown, fallbackModel: string): OpenRouterReply {
  const root = data as {
    model?: unknown;
    choices?: Array<{
      finish_reason?: unknown;
      message?: {
        content?: unknown;
        tool_calls?: Array<{ function?: { name?: unknown; arguments?: unknown } }>;
      };
    }>;
  } | null;
  const choice = root?.choices?.[0];
  const content = choice?.message?.content;
  const call = choice?.message?.tool_calls?.find((item) => item.function?.name);
  const finish = choice?.finish_reason;
  return {
    text: typeof content === "string" ? content.trim() : "",
    functionCall: call?.function
      ? { name: String(call.function.name), args: parseToolArgs(call.function.arguments) }
      : null,
    // Normaliza para o vocabulário do Gemini: o resto do chat só conhece esse.
    finishReason: finish === "length" ? "MAX_TOKENS" : finish ? "STOP" : null,
    model: typeof root?.model === "string" && root.model ? root.model : fallbackModel,
  };
}

/** Falha de HTTP sem corpo, chave ou mensagem do provedor: só o status. */
export class OpenRouterError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
  }
}

export async function generateOpenRouterReply(
  input: {
    systemPrompt: string;
    history: OpenRouterTurn[];
    mensagem: string;
    signal?: AbortSignal;
    tool?: OpenRouterToolDeclaration | null;
  },
  options: { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<OpenRouterReply> {
  const apiKey = options.apiKey ?? openRouterApiKey();
  if (!apiKey) throw new OpenRouterError("openrouter: sem chave");
  const model = openRouterModel();
  const timeout = AbortSignal.timeout(options.timeoutMs ?? CHAT_OPENROUTER_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  const response = await (options.fetchImpl ?? fetch)(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildOpenRouterBody({ ...input, model })),
    signal,
  });
  if (!response.ok) {
    throw new OpenRouterError(`openrouter ${response.status}`, response.status);
  }
  const data: unknown = await response.json().catch(() => null);
  return parseOpenRouterReply(data, model);
}
