/**
 * Rate limit em memória, com Upstash opcional quando
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN existem.
 * Sem essas vars (Hobby / um pod) o contador local ainda reduz abuso básico.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSec?: number };

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

function upstashConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
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
      ["EXPIRE", key, ttlSec],
    ]),
    signal: AbortSignal.timeout(2_500),
  });

  if (!response.ok) {
    throw new Error(`upstash ${response.status}`);
  }

  const data = (await response.json()) as Array<{ result?: number }>;
  const count = Number(data[0]?.result ?? 0);
  if (count > options.max) {
    return { ok: false, retryAfterSec: ttlSec };
  }
  return { ok: true };
}

export async function checkDistributedRateLimit(
  key: string,
  options: { windowMs: number; max: number },
): Promise<RateLimitResult> {
  if (upstashConfigured()) {
    try {
      const remote = await checkUpstashRateLimit(key, options);
      if (remote) return remote;
    } catch (error) {
      console.warn("[rate-limit] Upstash indisponível, usando memória:", error);
    }
  }
  return checkRateLimit(key, options);
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 8;

export function checkLoginRateLimit(key: string) {
  return checkRateLimit(`login:${key}`, {
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_MAX,
  });
}

export function clearLoginRateLimit(key: string) {
  clearRateLimit(`login:${key}`);
}

const SELL_LEAD_WINDOW_MS = 60 * 60 * 1000;
const SELL_LEAD_MAX = 5;

export async function checkSellLeadRateLimit(key: string) {
  return checkDistributedRateLimit(`sell-lead:${key}`, {
    windowMs: SELL_LEAD_WINDOW_MS,
    max: SELL_LEAD_MAX,
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
