/**
 * Texto natural para a lista de espera no WhatsApp.
 * O pixel continua usando stockSearchString (chave estável).
 */

import { formatBrandName, formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import { formatColorLabel } from "@/lib/vehicle-display";

export type StockWaitlistFilters = {
  q?: string;
  category?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  accessory?: string;
  laudo?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  maxKm?: string;
};

function compact(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function money(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? formatCurrencyBRL(amount)
    : value;
}

/** “Hyundai automático até R$ 50.000” — para preencher o WhatsApp. */
export function formatStockWaitlistQuery(input: StockWaitlistFilters) {
  const query = compact(input.q);
  if (query) return query;

  const bits: string[] = [];
  const brand = compact(input.brand);
  if (brand) bits.push(formatBrandName(brand));
  const category = compact(input.category);
  if (category) bits.push(vehicleCategoryLabel(category).toLocaleLowerCase("pt-BR"));
  const transmission = compact(input.transmission);
  if (transmission) bits.push(transmission.toLocaleLowerCase("pt-BR"));
  const fuel = compact(input.fuel);
  if (fuel) bits.push(fuel.toLocaleLowerCase("pt-BR"));
  const color = formatColorLabel(input.color);
  if (color) bits.push(color.toLocaleLowerCase("pt-BR"));

  const minPrice = compact(input.minPrice);
  const maxPrice = compact(input.maxPrice);
  if (minPrice && maxPrice) {
    bits.push(`de ${money(minPrice)} a ${money(maxPrice)}`);
  } else if (maxPrice) {
    bits.push(`até ${money(maxPrice)}`);
  } else if (minPrice) {
    bits.push(`a partir de ${money(minPrice)}`);
  }

  const minYear = compact(input.minYear);
  const maxYear = compact(input.maxYear);
  if (minYear && maxYear) bits.push(`${minYear}–${maxYear}`);
  else if (minYear) bits.push(`a partir de ${minYear}`);
  else if (maxYear) bits.push(`até ${maxYear}`);

  const maxKm = compact(input.maxKm);
  if (maxKm) {
    const km = Number(maxKm);
    bits.push(
      `até ${Number.isFinite(km) ? formatNumberBR(km) : maxKm} km`,
    );
  }

  const accessory = compact(input.accessory);
  if (accessory) bits.push(accessory);
  if (compact(input.laudo)) bits.push("com laudo");

  return bits.join(", ");
}
