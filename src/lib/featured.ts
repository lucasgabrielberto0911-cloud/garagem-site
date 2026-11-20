import { saoPauloDateKey } from "@/lib/stock-daily-order";

/** Teto da grade da vitrine (Home e /seminovos): até 8 veículos. */
export const MAX_HOME_FEATURED = 8;

/** Teto de veículos fixados manualmente pelo admin na home: até 4. */
export const MAX_FEATURED_PINS = 4;

const MS_PER_DAY = 86_400_000;

export function featuredSlotState(
  count: number,
  max = MAX_FEATURED_PINS,
) {
  const used = Math.max(0, count);
  return {
    count: used,
    max,
    remaining: Math.max(0, max - used),
    atCap: used >= max,
  };
}

/** Pode ligar o destaque fixo? Quem já está marcado pode permanecer (ou sair). */
export function canEnableFeatured(
  currentFeaturedCount: number,
  alreadyFeatured: boolean,
  max = MAX_FEATURED_PINS,
) {
  if (alreadyFeatured) return true;
  return currentFeaturedCount < max;
}

export function featuredCapMessage(max = MAX_FEATURED_PINS) {
  return `Dá para fixar no máximo ${max} destaques na home. Tire um da vitrine antes de marcar outro.`;
}

/**
 * Bloco de 2 dias corridos no fuso America/Sao_Paulo:
 * `period = floor(dias_desde_epoch / 2)`.
 */
export function featuredRotationPeriod(now: Date = new Date()): number {
  const dateKey = saoPauloDateKey(now);
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const utcDayMs = Date.UTC(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr),
  );
  const daysSinceEpoch = Math.floor(utcDayMs / MS_PER_DAY);
  return Math.floor(daysSinceEpoch / 2);
}

function hashPeriodSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    let t = (state = (state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Embaralha de forma determinística a partir de `period`, usando `id` como
 * ordenação base estável para que todo visitante e SSR/ISR vejam a mesma ordem.
 */
export function shuffleForFeaturedPeriod<T extends { id: string }>(
  items: readonly T[],
  period: number,
): T[] {
  if (items.length <= 1) return [...items];
  const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const rng = mulberry32(hashPeriodSeed(`home-featured-period:${period}`));
  for (let i = ordered.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = ordered[i]!;
    ordered[i] = ordered[j]!;
    ordered[j] = current;
  }
  return ordered;
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
 * Ordena os fixados da vitrine priorizando:
 * 1) unidades com foto de capa;
 * 2) ordem manual do painel (`featuredOrder`), quando existir;
 * 3) ano/modelo mais novo (`yearModel` desc) e menor `km`;
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
