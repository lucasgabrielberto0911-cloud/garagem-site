/** Sugestões no fim da ficha: mesmo tipo e faixa de preço, para não perder o lead. */

import { resolveTransmission } from "@/lib/vehicle-display";

export type RelatedVehicleCandidate = {
  id: string;
  brand: string;
  model?: string | null;
  version?: string | null;
  category?: string | null;
  price: number;
  featured?: boolean;
  transmission?: string | null;
  status?: string | null;
  /** Uso interno. A ficha não mostra este campo. */
  consigned?: boolean | null;
};

export type RelatedCurrentVehicle = {
  id?: string;
  brand: string;
  category?: string | null;
  price: number;
  transmission?: string | null;
  version?: string | null;
};

const CONSIGNMENT_LABEL = /\bconsignad/i;

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

function sameKind(a?: string | null, b?: string | null) {
  const left = (a ?? "").trim().toLocaleLowerCase("pt-BR");
  const right = (b ?? "").trim().toLocaleLowerCase("pt-BR");
  return left.length > 0 && left === right;
}

function labelsMatch(a: string, b: string) {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return false;
  return left.localeCompare(right, "pt-BR", { sensitivity: "accent" }) === 0;
}

function gearLabel(item: {
  version?: string | null;
  transmission?: string | null;
}) {
  return resolveTransmission(item.version, item.transmission).trim();
}

function isLabeledConsignment(item: RelatedVehicleCandidate) {
  if (item.consigned === true) return true;
  const text = [item.brand, item.model, item.version]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  return CONSIGNMENT_LABEL.test(text);
}

/** Mesmo tipo, perto no preço, à venda, e sem o anúncio da própria ficha. */
export function relatedVehicleFits(
  item: RelatedVehicleCandidate,
  current: RelatedCurrentVehicle,
) {
  if (current.id && item.id === current.id) return false;
  if (item.status != null && item.status !== "disponivel") return false;
  if (isLabeledConsignment(item)) return false;
  if (!sameKind(item.category, current.category)) return false;
  const { min, max } = priceBandRange(current.price);
  if (max <= 0 || !Number.isFinite(item.price)) return false;
  return item.price >= min && item.price <= max;
}

function sharesBrandOrGear(
  item: RelatedVehicleCandidate,
  current: RelatedCurrentVehicle,
) {
  return (
    labelsMatch(item.brand, current.brand) ||
    labelsMatch(gearLabel(item), gearLabel(current))
  );
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
  if (sameKind(current.category, item.category)) score += 4;
  if (labelsMatch(item.brand, current.brand)) score += 3;
  if (labelsMatch(gearLabel(item), gearLabel(current))) score += 3;
  if (item.featured) score += 1;
  return score;
}

function byCloseness(
  a: RelatedVehicleCandidate,
  b: RelatedVehicleCandidate,
  current: RelatedCurrentVehicle,
) {
  const byScore = relatedVehicleScore(b, current) - relatedVehicleScore(a, current);
  if (byScore !== 0) return byScore;
  const byPrice =
    Math.abs(a.price - current.price) - Math.abs(b.price - current.price);
  if (byPrice !== 0) return byPrice;
  return a.id.localeCompare(b.id);
}

/**
 * Até `take` anúncios que cabem na ficha.
 * Marca ou câmbio só restringem a lista quando ainda enchem o lote.
 * Com menos do que isso, os outros da mesma faixa completam.
 */
export function pickRelatedVehicles<T extends RelatedVehicleCandidate>(
  pool: T[],
  current: RelatedCurrentVehicle,
  take = 4,
): T[] {
  const limit = Number.isFinite(take) ? Math.max(0, Math.floor(take)) : 0;
  if (limit === 0) return [];

  const eligible = pool.filter((item) => relatedVehicleFits(item, current));
  const preferred = eligible.filter((item) => sharesBrandOrGear(item, current));
  const chosen = preferred.length >= limit ? preferred : eligible;

  return [...chosen]
    .sort((a, b) => byCloseness(a, b, current))
    .slice(0, limit);
}
