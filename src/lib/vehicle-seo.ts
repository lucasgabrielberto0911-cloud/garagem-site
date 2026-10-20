import { formatCurrencyBRL, formatVehicleLabel } from "@/lib/format";
import { shortVersion } from "@/lib/vehicle-display";
import { site } from "@/lib/site";

/** O Google corta títulos por volta de 60 caracteres. */
export const VEHICLE_SEO_TITLE_MAX = 60;

type VehicleSeoTitleInput = {
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  price?: number;
  sold?: boolean;
  siteName?: string;
  maxLength?: number;
};

/**
 * Título único para SEO com identificação do veículo, preço e busca regional:
 * "Honda Civic LXR 2015 por R$ 74.900 | seminovo ES | Garagem".
 *
 * Quando passa do limite (60 caracteres), corta palavras da versão antes do
 * sufixo para evitar que o buscador corte a marca e o contexto regional.
 * Carro vendido não divulga preço antigo: "Honda Civic LXR 2015 (vendido) | seminovo ES | Garagem".
 */
export function vehicleSeoTitle(input: VehicleSeoTitleInput) {
  const siteName = input.siteName ?? site.name;
  const max = input.maxLength ?? VEHICLE_SEO_TITLE_MAX;
  const base = formatVehicleLabel(input.brand, input.model);
  const year = String(input.yearModel);
  const versionTokens = shortVersion(input.version, input.model)
    .split(/\s+/)
    .filter(Boolean);

  const status = input.sold
    ? " (vendido)"
    : input.price != null && Number.isFinite(input.price) && input.price > 0
      ? ` por ${formatCurrencyBRL(input.price)}`
      : "";

  const suffixes = [` | seminovo ES | ${siteName}`, ` | ${siteName}`];

  for (const suffix of suffixes) {
    for (let n = versionTokens.length; n >= 0; n--) {
      const versionPart = versionTokens.slice(0, n).join(" ");
      const label = [base, versionPart, year].filter(Boolean).join(" ");
      const candidate = `${label}${status}${suffix}`;
      if (candidate.length <= max) return candidate;
    }
  }

  // Marca + modelo + ano + status já estouram o limite: devolve com sufixo mínimo sem quebrar.
  return `${[base, year].filter(Boolean).join(" ")}${status}${suffixes[suffixes.length - 1]}`;
}
