/**
 * Rate limit simples em memória para o login. Em múltiplas instâncias (Vercel)
 * cada pod tem o próprio contador — ainda reduz brute-force básico; para
 * proteção forte use WAF/Upstash depois.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function checkLoginRateLimit(key: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (current.count >= MAX_ATTEMPTS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  return { ok: true };
}

export function clearLoginRateLimit(key: string) {
  buckets.delete(key);
}
