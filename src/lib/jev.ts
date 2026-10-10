/**
 * Cliente do Jev (TypeSafe AI), só no servidor. Modelo de decisão, não gera texto:
 * manda um estado e perguntas tipadas num único pedido e devolve respostas
 * estruturadas. A chave fica em JEV_API_KEY e nunca sai daqui.
 *
 * Nunca lança: sem chave, timeout, erro HTTP ou resposta fora do formato
 * devolvem `null`, e quem chama segue sem a nota/leitura.
 * Cliente único: usado pela nota do anúncio no admin e pela leitura do chat.
 */

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-1.13.0";
export const JEV_TIMEOUT_MS = 4_500;

/**
 * score: `criteria` é uma lista ordenada de níveis e a resposta é o valor
 * esperado sobre o índice (0 … níveis − 1), não um número de 0 a 1.
 * choice: `criteria` mapeia cada opção à sua descrição.
 */
export type JevScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JevChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type JevNoulQuestion = {
  type: "noul";
  instructions: string;
};

export type JevQuestion =
  JevScoreQuestion | JevChoiceQuestion | JevNoulQuestion;

export type JevAnswers = Record<string, unknown>;

export type AskJevOptions = {
  fetchImpl?: typeof fetch;
  /** undefined lê JEV_API_KEY. null ou vazio não chama a rede. */
  apiKey?: string | null;
  signal?: AbortSignal;
  /** Padrão JEV_TIMEOUT_MS. O chat usa um prazo menor. */
  timeoutMs?: number;
};

export function jevConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(env.JEV_API_KEY?.trim());
}

export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
  options: AskJevOptions = {},
): Promise<JevAnswers | null> {
  const provided =
    options.apiKey === undefined ? process.env.JEV_API_KEY : options.apiKey;
  const apiKey = provided?.trim() ?? "";
  if (!apiKey) return null;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? JEV_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const started = Date.now();
  try {
    const response = await fetchImpl(JEV_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal,
    });
    if (!response.ok) {
      console.warn("[jev] falha: http", response.status);
      return null;
    }
    const data: unknown = await response.json();
    const answers = (data as { answers?: unknown } | null)?.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      console.warn("[jev] falha: resposta fora do formato");
      return null;
    }
    // Só status e latência: nada de chave, estado ou texto da conversa.
    console.info("[jev] ok", {
      status: response.status,
      ms: Date.now() - started,
    });
    return answers as JevAnswers;
  } catch (error) {
    // Só o tipo do erro: nada de mensagem, cabeçalho ou corpo no log.
    if (!options.signal?.aborted)
      console.warn(
        "[jev] falha:",
        error instanceof Error ? error.name : "erro",
      );
    return null;
  }
}

function answerOf(answers: JevAnswers, name: string) {
  const value = answers[name];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function unit(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

/** Score normalizado para 0–1 (índice ÷ (níveis − 1)) e a confiança. */
export function jevScore(answers: JevAnswers, name: string, levels: number) {
  const answer = answerOf(answers, name);
  if (!answer || answer.type !== "score" || levels < 2) return null;
  const raw = answer.score;
  const confidence = unit(answer.confidence);
  if (typeof raw !== "number" || !Number.isFinite(raw) || confidence == null)
    return null;
  const value = raw / (levels - 1);
  if (value < 0 || value > 1) return null;
  return { value, confidence };
}

/** Opção escolhida (só se for uma das esperadas) e a confiança. */
export function jevChoice<T extends string>(
  answers: JevAnswers,
  name: string,
  allowed: readonly T[],
) {
  const answer = answerOf(answers, name);
  if (!answer || answer.type !== "choice") return null;
  const confidence = unit(answer.confidence);
  const choice = answer.choice;
  if (confidence == null || typeof choice !== "string") return null;
  if (!(allowed as readonly string[]).includes(choice)) return null;
  return { choice: choice as T, confidence };
}
