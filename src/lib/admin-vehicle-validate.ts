/** Regras da ficha no painel — vitrine, não ERP. */

import { parseVehicleLocationCity } from "@/lib/vehicle-location";

export const MIN_LISTING_PRICE = 1;
export const MAX_LISTING_PRICE = 9_999_999;
export const MIN_KM = 0;
export const MAX_KM = 999_999;

export type VehicleListingFields = {
  brand?: string | null;
  model?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  color?: string | null;
  km?: number | null;
  price?: number | null;
  locationCity?: string | null;
};

export type VehicleListingIssue = {
  field: keyof VehicleListingFields | "form";
  message: string;
};

function trim(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function validateVehicleListing(
  input: VehicleListingFields,
): VehicleListingIssue[] {
  const issues: VehicleListingIssue[] = [];
  if (!trim(input.brand)) {
    issues.push({ field: "brand", message: "Informe a marca." });
  }
  if (!trim(input.model)) {
    issues.push({ field: "model", message: "Informe o modelo." });
  }
  if (!trim(input.fuel)) {
    issues.push({ field: "fuel", message: "Informe o combustível." });
  }
  if (!trim(input.transmission)) {
    issues.push({ field: "transmission", message: "Informe o câmbio." });
  }
  if (!trim(input.color)) {
    issues.push({
      field: "color",
      message: "Informe a cor (fica vazia no anúncio se faltar).",
    });
  }
  if (input.locationCity !== undefined) {
    if (!parseVehicleLocationCity(input.locationCity)) {
      issues.push({
        field: "locationCity",
        message: "Informe se o veículo está em Serra ou Linhares.",
      });
    }
  }

  const km = input.km;
  if (km == null || !Number.isFinite(km)) {
    issues.push({ field: "km", message: "Informe a quilometragem." });
  } else if (km < MIN_KM || km > MAX_KM) {
    issues.push({
      field: "km",
      message: `KM deve ficar entre ${MIN_KM.toLocaleString("pt-BR")} e ${MAX_KM.toLocaleString("pt-BR")}.`,
    });
  }

  const price = input.price;
  if (price == null || !Number.isFinite(price) || price < MIN_LISTING_PRICE) {
    issues.push({ field: "price", message: "Informe um preço válido." });
  } else if (price > MAX_LISTING_PRICE) {
    issues.push({
      field: "price",
      message: "Preço acima do teto do anúncio. Confira o valor.",
    });
  }

  return issues;
}

export function vehicleListingError(input: VehicleListingFields) {
  const issues = validateVehicleListing(input);
  return issues[0]?.message ?? null;
}

export function kmHint(km: number) {
  if (!Number.isFinite(km)) return null;
  if (km === 0) return "KM 0 — só use em seminovo zero km de verdade.";
  if (km > 400_000) return "KM alto — confira se o número está certo.";
  return null;
}

export type CitedPriceKind = "exact" | "mil";

export type CitedPrice = {
  amount: number;
  kind: CitedPriceKind;
  raw: string;
};

export type DescriptionPriceMismatch = {
  listedPrice: number;
  citedPrices: number[];
  /** Aviso (reservado/vendido ainda salvam). */
  message: string;
  /** Erro duro: disponível/destaque não publicam até bater o preço. */
  blockMessage: string;
};

/** Status da vitrine pública — é este que trava o save. */
export const PUBLIC_LISTING_STATUS = "disponivel";

/** Interpreta 89.900 / 89.900,00 / 89900. */
export function parseBrCurrencyToken(value: string) {
  const trimmed = value.replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  if (!trimmed) return null;
  const withoutCents = trimmed.replace(/,\d{1,2}$/, "");
  const amount = Number(withoutCents.replace(/\./g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

function afterMatch(text: string, index: number, length: number) {
  return text.slice(index + length, index + length + 12).trimStart();
}

function isKmContext(text: string, index: number, length: number) {
  return /^(km|quilometr)/i.test(afterMatch(text, index, length));
}

const CITED_MIN = 1_000;

/**
 * Preços citados no texto do anúncio. Só pega R$, “mil” e “reais” —
 * não trata 32.000 km nem ano 2018 como valor.
 */
export function extractCitedPrices(text: string): CitedPrice[] {
  const found: CitedPrice[] = [];
  const seen = new Set<string>();

  function push(amount: number, kind: CitedPriceKind, raw: string) {
    if (amount < CITED_MIN || amount > MAX_LISTING_PRICE) return;
    const key = `${kind}:${amount}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ amount, kind, raw: raw.trim() });
  }

  const source = text ?? "";

  for (const match of source.matchAll(
    /R\$\s*(\d{1,3}(?:\.\d{3})+|\d{4,7})(?:,\d{1,2})?/gi,
  )) {
    if (match.index == null) continue;
    if (isKmContext(source, match.index, match[0].length)) continue;
    const amount = parseBrCurrencyToken(match[0]);
    if (amount != null) push(amount, "exact", match[0]);
  }

  for (const match of source.matchAll(/(?:R\$\s*)?(\d{1,3})\s*mil\b/gi)) {
    if (match.index == null) continue;
    if (isKmContext(source, match.index, match[0].length)) continue;
    const thousands = Number(match[1]);
    if (!Number.isFinite(thousands) || thousands <= 0) continue;
    push(Math.round(thousands * 1000), "mil", match[0]);
  }

  for (const match of source.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*reais\b/gi)) {
    if (match.index == null) continue;
    if (isKmContext(source, match.index, match[0].length)) continue;
    const amount = parseBrCurrencyToken(match[1]);
    if (amount != null) push(amount, "exact", match[0]);
  }

  return found;
}

function citedAgreesWithListed(cited: CitedPrice, listedPrice: number) {
  if (cited.kind === "mil") {
    return Math.abs(cited.amount - listedPrice) < 1000;
  }
  return Math.abs(cited.amount - listedPrice) <= 50;
}

function formatCitedList(amounts: number[]) {
  return amounts
    .map((amount) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(amount),
    )
    .join(" e ");
}

function descriptionPriceCoreMessage(cited: string, listed: string) {
  return `A descrição cita ${cited}, mas o preço do anúncio é ${listed}.`;
}

/**
 * Disponível (vitrine / destaque) trava o save. Reservado e vendido só avisam —
 * não tem rascunho no produto; vendido já saiu do estoque público.
 */
export function descriptionPriceMismatchBlocksSave(status?: string | null) {
  const value = (status ?? PUBLIC_LISTING_STATUS).trim() || PUBLIC_LISTING_STATUS;
  return value === PUBLIC_LISTING_STATUS;
}

/** Aviso quando o texto ainda cita um preço diferente do campo. */
export function descriptionPriceMismatch(
  description: string,
  listedPrice: number,
): DescriptionPriceMismatch | null {
  if (!Number.isFinite(listedPrice) || listedPrice < MIN_LISTING_PRICE) {
    return null;
  }
  if (!(description ?? "").trim()) return null;

  const disagree = extractCitedPrices(description).filter(
    (cited) => !citedAgreesWithListed(cited, listedPrice),
  );
  if (disagree.length === 0) return null;

  const citedPrices = [...new Set(disagree.map((item) => item.amount))];
  const listed = formatCitedList([listedPrice]);
  const cited = formatCitedList(citedPrices);
  const core = descriptionPriceCoreMessage(cited, listed);

  return {
    listedPrice,
    citedPrices,
    message: `${core} Quem lê o texto vê o valor antigo.`,
    blockMessage: `${core} Corrija a descrição ou o preço antes de salvar.`,
  };
}

/** Erro de save quando o anúncio iria à vitrine (disponível / destaque). */
export function descriptionPriceSaveError(input: {
  description?: string | null;
  price: number;
  status?: string | null;
}) {
  const mismatch = descriptionPriceMismatch(input.description ?? "", input.price);
  if (!mismatch) return null;
  if (!descriptionPriceMismatchBlocksSave(input.status)) return null;
  return mismatch.blockMessage;
}
