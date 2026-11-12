import { createHash } from "node:crypto";

export const ADMIN_AI_MODEL = "mistralai/mistral-large-4-1t-a52b";
const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();

/** Motivos de falha da IA do painel. Nunca carregam chave, prompt nem resposta bruta. */
export type AiFailure =
  | "sem_chave"
  | "rede"
  | "tempo_esgotado"
  | "limite"
  | "chave_recusada"
  | "modelo_indisponivel"
  | "recusado"
  | "provedor"
  | "resposta_invalida";

export const AI_FAILURE_LABELS: Record<AiFailure, string> = {
  sem_chave: "chave da IA não configurada neste ambiente",
  rede: "falha de rede ao chamar a IA",
  tempo_esgotado: "a IA demorou demais para responder",
  limite: "limite de uso da IA atingido, tente de novo em instantes",
  chave_recusada: "a chave da IA foi recusada pelo provedor",
  modelo_indisponivel: "o modelo de IA não está disponível no provedor",
  recusado: "o provedor recusou o pedido da IA",
  provedor: "o provedor de IA está instável",
  resposta_invalida: "a resposta da IA veio fora do formato esperado",
};

export class AiError extends Error {
  constructor(readonly failure: AiFailure, readonly status?: number) {
    super(AI_FAILURE_LABELS[failure]);
    this.name = "AiError";
  }
}

export function aiFailureOf(error: unknown): AiFailure {
  return error instanceof AiError ? error.failure : "resposta_invalida";
}

/** Texto curto para o operador do painel, com o código HTTP quando existe. */
export function aiFailureText(failure: AiFailure, status?: number): string {
  return `${AI_FAILURE_LABELS[failure]}${status ? ` (HTTP ${status})` : ""}`;
}

export function failureFromStatus(status: number): AiFailure {
  if (status === 401 || status === 403) return "chave_recusada";
  if (status === 404) return "modelo_indisponivel";
  if (status === 429) return "limite";
  if (status >= 500) return "provedor";
  return "recusado";
}

/** Registra só fase, motivo e status. A mensagem do provedor só vai em erro 4xx de parâmetro e fica curta. */
function logFailure(phase: string, failure: AiFailure, status?: number, detail?: string) {
  console.warn("[compra-ia]", { fase: phase, motivo: failure, status: status ?? null, ...(detail ? { detalhe: detail } : {}) });
}

async function providerDetail(response: Response): Promise<string | undefined> {
  if (response.status !== 400 && response.status !== 422) return undefined;
  try {
    const text = (await response.text()).slice(0, 1000);
    const data = JSON.parse(text) as { detail?: unknown; error?: { message?: unknown }; message?: unknown };
    const message = [data.error?.message, data.detail, data.message].find((v) => typeof v === "string") as string | undefined;
    return message?.replace(/\s+/g, " ").slice(0, 160);
  } catch {
    return undefined;
  }
}

export async function completeNvidia(phase: string, payload: unknown, system: string, options: { purchaseFallback?: boolean } = {}): Promise<unknown> {
  const apiKey = process.env.ADMIN_AI_NVIDIA_API_KEY?.trim() || (options.purchaseFallback ? process.env.NVIDIA_API_KEY?.trim() : undefined);
  if (!apiKey) throw new AiError("sem_chave");
  const key = createHash("sha256").update(JSON.stringify([ADMIN_AI_MODEL, phase, system, payload, createHash("sha256").update(apiKey).digest("hex")])).digest("hex"), now = Date.now();
  const previous = cache.get(key);
  if (previous && previous.expires > now) return previous.promise;
  for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  const promise = (async () => {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ model: ADMIN_AI_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(payload) }], temperature: 0.2, max_tokens: 4096, reasoning_effort: "low", stream: false, response_format: { type: "json_object" } }) });
    } catch (error) {
      const timeout = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
      const failure: AiFailure = timeout ? "tempo_esgotado" : "rede";
      logFailure(phase, failure);
      throw new AiError(failure);
    }
    if (!response.ok) {
      const failure = failureFromStatus(response.status);
      logFailure(phase, failure, response.status, await providerDetail(response));
      throw new AiError(failure, response.status);
    }
    try {
      const raw = await response.text();
      if (raw.length > 100_000) throw new Error("grande demais");
      const data = JSON.parse(raw);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("sem conteúdo");
      return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      logFailure(phase, "resposta_invalida", response.status);
      throw new AiError("resposta_invalida", response.status);
    }
  })();
  // Cache apenas em memória; chave não contém placa, documentos nem texto em claro.
  cache.set(key, { expires: now + 900_000, promise });
  promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); });
  return promise;
}
