/**
 * Rate limit simples em memória. Em múltiplas instâncias (Vercel) cada pod tem
 * o próprio contador — ainda reduz abuso básico; para proteção forte use
 * WAF/Upstash depois.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  options: { windowMs: number; max: number },
): { ok: boolean; retryAfterSec?: number } {
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

export function checkSellLeadRateLimit(key: string) {
  return checkRateLimit(`sell-lead:${key}`, {
    windowMs: SELL_LEAD_WINDOW_MS,
    max: SELL_LEAD_MAX,
  });
}
