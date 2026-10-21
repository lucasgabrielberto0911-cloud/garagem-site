/** Limitador compartilhado; rotas públicas bloqueiam quando os contadores ficam indisponíveis. */
import {
  checkSharedLimit,
  checkSharedLoginLimit,
  clearSharedLoginLimit,
} from "@/lib/admin-login-limit";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSec?: number; unavailable?: boolean };

export function checkRateLimit(
  key: string,
  options: { windowMs: number; max: number },
): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true };
  }

  if (current.count >= options.max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  return { ok: true };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export function isUpstashConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(
    env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

async function checkUpstashRateLimit(
  key: string,
  options: { windowMs: number; max: number },
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const ttlSec = Math.max(1, Math.ceil(options.windowMs / 1000));
  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, ttlSec, "NX"],
    ]),
    signal: AbortSignal.timeout(2_500),
  });

  if (!response.ok) {
    throw new Error(`upstash ${response.status}`);
  }

  const data = (await response.json()) as Array<{ result?: number }>;
  const count = data[0]?.result;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 || data.length !== 2 || ![0, 1].includes(data[1]?.result ?? -1)) {
    throw new Error("Resposta inválida do contador compartilhado");
  }
  if (count > options.max) {
    return { ok: false, retryAfterSec: ttlSec };
  }
  return { ok: true };
}

export async function checkDistributedRateLimit(
  key: string,
  options: { windowMs: number; max: number; failClosed?: boolean },
): Promise<RateLimitResult> {
  if (isUpstashConfigured()) {
    try {
      const remote = await checkUpstashRateLimit(key, options);
      if (remote) return remote;
    } catch {
      console.warn("[rate-limit] Upstash indisponível; tentando contador no banco.");
    }
  }
  // Sem Upstash, o contador no banco vale para todas as instâncias; a memória
  // de cada função serverless sozinha quase não limita nada.
  if (process.env.DATABASE_URL?.trim() && !process.env.RATE_LIMIT_MEMORY_ONLY) {
    try {
      return await checkSharedLimit(`rl:${key}`, options);
    } catch {
      console.warn("[rate-limit] Contador no banco indisponível.");
    }
  }
  if (options.failClosed) {
    console.error("[rate-limit] ALERTA: contadores compartilhados indisponíveis; requisição pública bloqueada.");
    return { ok: false, unavailable: true, retryAfterSec: 30 };
  }
  return checkRateLimit(key, options);
}

export async function checkLoginRateLimit(key: string) {
  try {
    return await checkSharedLoginLimit(key);
  } catch (error) {
    console.error("[login-limit] Contador compartilhado indisponível:", error);
    return checkDistributedRateLimit(`login:${key}`, {
      windowMs: 900000,
      max: 8,
    });
  }
}
export async function clearLoginRateLimit(key: string) {
  try {
    await clearSharedLoginLimit(key);
  } catch {
    clearRateLimit(`login:${key}`);
  }
}

const SELL_LEAD_WINDOW_MS = 60 * 60 * 1000;
const SELL_LEAD_MAX = 5;

export async function checkSellLeadRateLimit(key: string) {
  return checkDistributedRateLimit(`sell-lead:${key}`, {
    windowMs: SELL_LEAD_WINDOW_MS,
    max: SELL_LEAD_MAX,
    failClosed: true,
  });
}

const WANTED_LEAD_WINDOW_MS = 60 * 60 * 1000;
const WANTED_LEAD_MAX = 5;

export async function checkWantedLeadRateLimit(key: string) {
  return checkDistributedRateLimit(`wanted-lead:${key}`, {
    windowMs: WANTED_LEAD_WINDOW_MS,
    max: WANTED_LEAD_MAX,
    failClosed: true,
  });
}

const VENDER_PHOTO_WINDOW_MS = 15 * 60 * 1000;
const VENDER_PHOTO_MAX = 8;

export async function checkVenderPhotoRateLimit(key: string) {
  return checkDistributedRateLimit(`vender-photo:${key}`, {
    windowMs: VENDER_PHOTO_WINDOW_MS,
    max: VENDER_PHOTO_MAX,
  });
}

const PHOTO_JPG_WINDOW_MS = 10 * 60 * 1000;
const PHOTO_JPG_MAX = 60;

/** Conversão WebP→JPEG no download público. Não conta a exibição da ficha. */
export async function checkPhotoJpgRateLimit(key: string) {
  return checkDistributedRateLimit(`photo-jpg:${key}`, {
    windowMs: PHOTO_JPG_WINDOW_MS,
    max: PHOTO_JPG_MAX,
    failClosed: true,
  });
}
