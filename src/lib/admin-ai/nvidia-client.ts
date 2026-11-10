import { createHash } from "node:crypto";

export const ADMIN_AI_MODEL = "mistralai/mistral-large-4-1t-a52b";
const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();
export async function completeNvidia(phase: string, payload: unknown, system: string, options: { purchaseFallback?: boolean } = {}): Promise<unknown> {
  const apiKey = process.env.ADMIN_AI_NVIDIA_API_KEY?.trim() || (options.purchaseFallback ? process.env.NVIDIA_API_KEY?.trim() : undefined);
  if (!apiKey) throw new Error("IA indisponível.");
  const key = createHash("sha256").update(JSON.stringify([ADMIN_AI_MODEL, phase, system, payload, createHash("sha256").update(apiKey).digest("hex")])).digest("hex"), now = Date.now();
  const previous = cache.get(key);
  if (previous && previous.expires > now) return previous.promise;
  for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  const promise = (async () => {
    const response = await fetch(ENDPOINT, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ model: ADMIN_AI_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(payload) }], temperature: 0.2, max_tokens: 4096, reasoning_effort: "low", stream: false, response_format: { type: "json_object" } }) });
    if (!response.ok) throw new Error("Provedor indisponível.");
    const raw = await response.text();
    if (raw.length > 100_000) throw new Error("Resposta de IA grande demais.");
    const data = JSON.parse(raw);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Resposta de IA inválida.");
    return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  })();
  // Cache apenas em memória; chave não contém placa, documentos nem texto em claro.
  cache.set(key, { expires: now + 900_000, promise });
  promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); });
  return promise;
}
