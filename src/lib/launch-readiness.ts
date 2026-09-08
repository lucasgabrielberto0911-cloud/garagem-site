/**
 * Sinais operacionais do lançamento público.
 * Não expõe segredos — só diz se a peça está configurada.
 *
 * Publicar só com aprovação explícita. Rollback: promover o deployment
 * Vercel anterior; se o problema for o chat, ocultar só as entradas do
 * assistente e manter site + WhatsApp. Não reverter schema destrutivamente.
 */

import { isUpstashConfigured } from "@/lib/rate-limit";

export type ChatRateLimitMode = "upstash" | "memory";

export function chatRateLimitStatus(
  env: Record<string, string | undefined> = process.env,
): {
  mode: ChatRateLimitMode;
  launchException?: string;
} {
  if (isUpstashConfigured(env)) {
    return { mode: "upstash" };
  }
  return {
    mode: "memory",
    launchException:
      "Chat público sem Upstash: o limite de 30 mensagens/dia fica só na memória do pod. Registrar esta exceção operacional ou configurar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN antes do lançamento.",
  };
}

export function geminiKeyConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(
    env.GEMINI_API_KEY?.trim() ||
      env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      env.GOOGLE_API_KEY?.trim(),
  );
}
