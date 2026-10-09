import { formatCurrencyBRL, formatKmBR, formatVehicleLabel } from "@/lib/format";
import { resolveTransmission, shortVersion } from "@/lib/vehicle-display";

/**
 * Fatos de compra no card público.
 * Só entra o que está no anúncio. Vazio some — sem traço, sem cidade padrão,
 * sem laudo e sem a palavra Consignado.
 */

export type PublicCardFactLabel = "Ano" | "Km" | "Câmbio" | "Cidade";

export type PublicCardFact = {
  label: PublicCardFactLabel;
  value: string;
};

export type PublicCardFactsInput = {
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  yearModel?: number | null;
  km?: number | null;
  transmission?: string | null;
  locationCity?: string | null;
  price?: number | null;
};

export type PublicCardFacts = {
  /** Marca + modelo, sem ano. */
  title: string;
  /** Versão curta. Câmbio sai daqui porque tem fato próprio. */
  version: string;
  /** Vazio quando o preço não é publicável. */
  priceLabel: string;
  facts: PublicCardFact[];
};

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function publicCardFacts(input: PublicCardFactsInput): PublicCardFacts {
  const model = input.model ?? "";
  const title = formatVehicleLabel(input.brand ?? "", model).trim();
  const version = shortVersion(input.version, model);
  const price = finiteNumber(input.price);
  const priceLabel =
    price != null && price > 0 ? formatCurrencyBRL(price) : "";

  const facts: PublicCardFact[] = [];

  const year = finiteNumber(input.yearModel);
  if (year != null && Number.isInteger(year) && year >= 1900 && year <= 2100) {
    facts.push({ label: "Ano", value: String(year) });
  }

  const km = finiteNumber(input.km);
  if (km != null && km >= 0) {
    facts.push({ label: "Km", value: formatKmBR(km) });
  }

  const gear = resolveTransmission(input.version, input.transmission);
  if (gear) facts.push({ label: "Câmbio", value: gear });


  return { title, version, priceLabel, facts };
}
