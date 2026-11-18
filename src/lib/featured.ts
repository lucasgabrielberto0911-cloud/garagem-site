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

export type ShowcaseVehicleLike = {
  id: string;
  yearModel: number;
  km: number;
  featured?: boolean;
  featuredOrder?: number | null;
  createdAt?: Date | string;
  photos?: ReadonlyArray<{ url?: string | null; thumbnailUrl?: string | null }> | null;
};

export function hasShowcaseCoverPhoto(
  vehicle: Pick<ShowcaseVehicleLike, "photos">,
): boolean {
  const cover = vehicle.photos?.[0];
  if (!cover) return false;
  return Boolean(cover.thumbnailUrl?.trim() || cover.url?.trim());
}

function toTimestamp(value: Date | string | undefined): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Ordena a vitrine (Home e /seminovos) priorizando:
 * 1) unidades com foto de capa;
 * 2) ordem manual do painel (`featuredOrder`), quando existir;
 * 3) ano/modelo mais novo (`yearModel` desc) e menor `km` na 1ª linha;
 * 4) destaque marcado, cadastro mais recente e `id` como desempate estável.
 */
export function sortShowcaseVehicles<T extends ShowcaseVehicleLike>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const aCover = hasShowcaseCoverPhoto(a) ? 1 : 0;
    const bCover = hasShowcaseCoverPhoto(b) ? 1 : 0;
    if (aCover !== bCover) return bCover - aCover;

    const aOrder =
      typeof a.featuredOrder === "number" && Number.isFinite(a.featuredOrder)
        ? a.featuredOrder
        : Number.MAX_SAFE_INTEGER;
    const bOrder =
      typeof b.featuredOrder === "number" && Number.isFinite(b.featuredOrder)
        ? b.featuredOrder
        : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    if (a.yearModel !== b.yearModel) return b.yearModel - a.yearModel;
    if (a.km !== b.km) return a.km - b.km;

    const aFeatured = a.featured ? 1 : 0;
    const bFeatured = b.featured ? 1 : 0;
    if (aFeatured !== bFeatured) return bFeatured - aFeatured;

    const timeDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id);
  });
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
