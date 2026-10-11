/**
 * Cliente do Jev (TypeSafe), só no servidor.
 * A chave fica em JEV_API_KEY. Sem chave ou com a API fora, devolve null
 * e não propaga erro — quem chama segue sem a nota.
 */

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-1.13.0";

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

export type JevQuestion = JevScoreQuestion | JevChoiceQuestion | JevNoulQuestion;

type AskJevOptions = {
  fetchImpl?: typeof fetch;
  /** undefined lê JEV_API_KEY. null ou vazio não chama a rede. */
  apiKey?: string | null;
  signal?: AbortSignal;
};

export async function askJev(
  state: string,
  questions: Record<string, JevQuestion>,
  options: AskJevOptions = {},
): Promise<Record<string, unknown> | null> {
  const provided = options.apiKey === undefined ? process.env.JEV_API_KEY : options.apiKey;
  const apiKey = provided?.trim() ?? "";
  if (!apiKey) return null;

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 4_500);
  const parent = options.signal;
  const abortFromParent = () => timeout.abort();
  if (parent?.aborted) {
    clearTimeout(timer);
    return null;
  }
  parent?.addEventListener("abort", abortFromParent);

  try {
    const response = await fetchImpl(JEV_ENDPOINT, {
      method: "POST",
      signal: timeout.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: JEV_MODEL,
        state,
        questions,
      }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("answers" in payload)) return null;
    const answers = (payload as { answers: unknown }).answers;
    if (!answers || typeof answers !== "object") return null;
    return answers as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abortFromParent);
  }
}
