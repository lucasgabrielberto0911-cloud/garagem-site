/** Avisos de qualidade do anúncio (painel de estoque e dashboard). */

const DAY_MS = 1000 * 60 * 60 * 24;

/** Disponível parado há mais tempo que isso entra nos alertas. */
export const STALE_DAYS = 60;

export function daysInStock(createdAt: Date) {
  return Math.floor((Date.now() - createdAt.getTime()) / DAY_MS);
}

export function isStaleListing(createdAt: Date, status?: string) {
  if (status && status !== "disponivel") return false;
  return daysInStock(createdAt) >= STALE_DAYS;
}

export function staleCutoffDate(days = STALE_DAYS) {
  return new Date(Date.now() - days * DAY_MS);
}
