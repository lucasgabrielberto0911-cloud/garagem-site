/**
 * Ficha pública: campos centrais sempre visíveis, sem buraco feio
 * quando cor/motor/laudo não foram preenchidos.
 */

import { formatNumberBR } from "@/lib/format";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import {
  parseVehicleLocationCity,
  vehicleLocationLabel,
} from "@/lib/vehicle-location";

export const SPEC_EMPTY = "Não informado";
export const SPEC_EMPTY_FEMININE = "Não informada";

export type VehicleSpecRow = {
  label: string;
  value: string;
  empty?: boolean;
};

export type VehiclePublicSpecsInput = {
  category: string;
  year: number;
  yearModel: number;
  km: number;
  fuel: string;
  transmission: string;
  color?: string | null;
  engine?: string | null;
  doors?: number | null;
  plateEnd?: string | null;
  warranty?: string | null;
  inspection?: string | null;
  locationCity?: string | null;
};

function filled(value: string | null | undefined) {
  return Boolean(value?.replace(/\s+/g, " ").trim());
}

function specValue(value: string | null | undefined, empty = SPEC_EMPTY) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text || empty;
}

export function formatVehicleYearRange(year: number, yearModel: number) {
  if (!year && !yearModel) return SPEC_EMPTY;
  if (year && yearModel && year !== yearModel) return `${year}/${yearModel}`;
  return String(yearModel || year);
}

/** Tipo, ano, km, câmbio, combustível e cor — sempre. Opcionais só se existirem. */
export function buildVehiclePublicSpecs(
  vehicle: VehiclePublicSpecsInput,
): VehicleSpecRow[] {
  const yearValue = formatVehicleYearRange(vehicle.year, vehicle.yearModel);
  const transmission = specValue(vehicle.transmission);
  const fuel = specValue(vehicle.fuel);
  const color = specValue(vehicle.color, SPEC_EMPTY_FEMININE);

  const rows: VehicleSpecRow[] = [
    { label: "Tipo", value: vehicleCategoryLabel(vehicle.category) },
    { label: "Ano", value: yearValue, empty: yearValue === SPEC_EMPTY },
    { label: "KM", value: formatNumberBR(vehicle.km) },
    { label: "Câmbio", value: transmission, empty: !filled(vehicle.transmission) },
    { label: "Combustível", value: fuel, empty: !filled(vehicle.fuel) },
    { label: "Cor", value: color, empty: !filled(vehicle.color) },
  ];

  if (filled(vehicle.engine)) {
    rows.push({ label: "Motor", value: vehicle.engine!.trim() });
  }
  if (vehicle.category !== "moto" && vehicle.doors != null && vehicle.doors > 0) {
    rows.push({ label: "Portas", value: String(vehicle.doors) });
  }
  if (filled(vehicle.plateEnd)) {
    rows.push({ label: "Final placa", value: vehicle.plateEnd!.trim() });
  }
  if (filled(vehicle.warranty)) {
    rows.push({ label: "Garantia", value: vehicle.warranty!.trim() });
  }
  if (filled(vehicle.inspection)) {
    rows.push({ label: "Laudo", value: vehicle.inspection!.trim() });
  }
  const location = parseVehicleLocationCity(vehicle.locationCity);
  if (location) {
    rows.push({
      label: "Disponível em",
      value: vehicleLocationLabel(location),
    });
  }

  return rows;
}
