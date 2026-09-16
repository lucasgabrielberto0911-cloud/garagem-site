/** Relacionados da ficha: mesma faixa de preço, para não perder o lead. */

export type RelatedVehicleCandidate = {
  id: string;
  brand: string;
  category?: string | null;
  price: number;
  featured?: boolean;
};

export type RelatedCurrentVehicle = {
  id?: string;
  brand: string;
  category?: string | null;
  price: number;
};

/** ±20% do preço, com piso de R$ 8 mil para seminovos baratos. */
export function priceBandRange(price: number) {
  if (!Number.isFinite(price) || price <= 0) {
    return { min: 0, max: 0 };
  }
  const pad = Math.max(Math.round(price * 0.2), 8_000);
  return {
    min: Math.max(0, Math.round(price - pad)),
    max: Math.round(price + pad),
  };
}

export function priceBandHref(price: number) {
  const { min, max } = priceBandRange(price);
  if (max <= 0) return "/estoque";
  const query = new URLSearchParams();
  if (min > 0) query.set("minPrice", String(min));
  query.set("maxPrice", String(max));
  return `/estoque?${query.toString()}`;
}

export function relatedVehicleScore(
  item: RelatedVehicleCandidate,
  current: RelatedCurrentVehicle,
) {
  const price = current.price;
  let score = 0;
  if (price > 0 && item.price > 0) {
    const rel = Math.abs(item.price - price) / price;
    if (rel <= 0.12) score += 12;
    else if (rel <= 0.2) score += 9;
    else if (rel <= 0.3) score += 5;
    else if (rel <= 0.45) score += 2;
  }
  if (current.category && item.category === current.category) score += 4;
  if (
    item.brand.localeCompare(current.brand, "pt-BR", { sensitivity: "accent" }) ===
    0
  ) {
    score += 3;
  }
  if (item.featured) score += 1;
  return score;
}

export function pickRelatedVehicles<T extends RelatedVehicleCandidate>(
  pool: T[],
  current: RelatedCurrentVehicle,
  take = 4,
): T[] {
  const others = current.id
    ? pool.filter((item) => item.id !== current.id)
    : pool;
  return [...others]
    .sort((a, b) => {
      const byScore =
        relatedVehicleScore(b, current) - relatedVehicleScore(a, current);
      if (byScore !== 0) return byScore;
      return (
        Math.abs(a.price - current.price) - Math.abs(b.price - current.price)
      );
    })
    .slice(0, take);
}
