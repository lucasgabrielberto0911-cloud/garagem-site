/** Teto da home: o painel marca os destaques; o site não inventa vitrine. */
export const MAX_HOME_FEATURED = 8;

export function featuredSlotState(
  count: number,
  max = MAX_HOME_FEATURED,
) {
  const used = Math.max(0, count);
  return {
    count: used,
    max,
    remaining: Math.max(0, max - used),
    atCap: used >= max,
  };
}

/** Pode ligar o destaque? Quem já está marcado pode permanecer (ou sair). */
export function canEnableFeatured(
  currentFeaturedCount: number,
  alreadyFeatured: boolean,
  max = MAX_HOME_FEATURED,
) {
  if (alreadyFeatured) return true;
  return currentFeaturedCount < max;
}

export function featuredCapMessage(max = MAX_HOME_FEATURED) {
  return `A home cabe no máximo ${max} destaques. Tire um da vitrine antes de marcar outro.`;
}

export function nextFeaturedOrder(existing: Array<number | null | undefined>) {
  const numbers = existing.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (numbers.length === 0) return 1;
  return Math.max(...numbers) + 1;
}

export function sortFeaturedForHome<
  T extends { featuredOrder?: number | null; createdAt?: Date | string },
>(items: T[]) {
  return [...items].sort((a, b) => {
    const ao = a.featuredOrder == null ? Number.MAX_SAFE_INTEGER : a.featuredOrder;
    const bo = b.featuredOrder == null ? Number.MAX_SAFE_INTEGER : b.featuredOrder;
    if (ao !== bo) return ao - bo;
    const at = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt ?? 0).getTime();
    const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt ?? 0).getTime();
    return bt - at;
  });
}

/** Reordena ids (índice from → to) e devolve a nova sequência da home. */
export function moveFeaturedIds(ids: string[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length ||
    fromIndex === toIndex
  ) {
    return ids.slice();
  }
  const next = ids.slice();
  const [item] = next.splice(fromIndex, 1);
  if (!item) return ids.slice();
  next.splice(toIndex, 0, item);
  return next;
}

export function featuredOrdersFromIds(ids: string[]) {
  return ids.map((id, index) => ({ id, featuredOrder: index + 1 }));
}
