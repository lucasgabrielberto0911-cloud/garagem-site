import { formatCurrencyBRL } from "@/lib/format";
import { buildVehicleFullLabel } from "@/lib/vehicle-display";
import { site } from "@/lib/site";

type VehicleSeoTitleInput = {
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  price?: number;
  sold?: boolean;
  siteName?: string;
};

/** Preserva a identificação do carro mesmo quando o buscador abrevia o título. */
export function vehicleSeoTitle(input: VehicleSeoTitleInput) {
  const label = buildVehicleFullLabel(input);
  const status = input.sold
    ? " (vendido)"
    : input.price != null && Number.isFinite(input.price) && input.price > 0
      ? ` por ${formatCurrencyBRL(input.price)}`
      : "";
  return `${label}${status} | seminovo ES | ${input.siteName ?? site.name}`;
}
