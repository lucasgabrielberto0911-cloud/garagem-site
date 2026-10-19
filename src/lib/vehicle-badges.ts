export const NEW_BADGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Selo "Novo": anunciado há no máximo 7 dias. */
export function isNewListing(createdAt: Date | string, now: Date = new Date()) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const age = now.getTime() - created;
  return age >= 0 && age <= NEW_BADGE_DAYS * DAY_MS;
}

/**
 * Valor da queda: só com histórico real. `history` vem em qualquer ordem;
 * compara com o último preço registrado diferente do atual. 0 = sem queda.
 */
export function priceDropAmount(
  currentPrice: number,
  history: { price: number; createdAt: Date | string }[],
) {
  if (!(currentPrice > 0)) return 0;
  const sorted = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const previous = sorted.find((entry) => entry.price !== currentPrice);
  return previous && currentPrice < previous.price ? previous.price - currentPrice : 0;
}

export function hasPriceDrop(
  currentPrice: number,
  history: { price: number; createdAt: Date | string }[],
) {
  return priceDropAmount(currentPrice, history) > 0;
}
