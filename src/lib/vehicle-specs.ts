/**
 * Ficha pública: campos centrais sempre visíveis, sem buraco feio
 * quando cor, motor ou vistoria da loja não foram preenchidos.
 */

import { formatNumberBR } from "@/lib/format";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import {
  isLegacyStoreInspectionCopy,
  withoutInspectionDisclaimer,
} from "@/lib/vehicle-conditions";

export const SPEC_EMPTY = "Não informado";
export const SPEC_EMPTY_FEMININE = "Não informada";

/** Nome único da checagem interna na ficha, no filtro e no selo. */
export const STORE_INSPECTION_LABEL = "Vistoria da loja";

/**
 * Parágrafo genérico antigo da loja. Não é o texto de um anúncio
 * (ex.: "Cautelar aprovado") e não vira selo.
 */
export const STORE_INSPECTION_NOTE = "Checagem interna, antes do estoque";

/**
 * Texto da vistoria neste anúncio.
 * Vazio fica null. O parágrafo genérico antigo vira a nota curta da loja.
 * "Cautelar aprovado" e qualquer nota própria permanecem — só sai a frase
 * de documento oficial, sem inventar laudo.
 */
export function publicInspectionNote(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (isLegacyStoreInspectionCopy(text)) return STORE_INSPECTION_NOTE;
  const cleaned = withoutInspectionDisclaimer(text);
  return cleaned || null;
}

/**
 * Selo visível da ficha. Só o texto deste anúncio.
 * Campo vazio, aviso solto ou o parágrafo genérico da loja não geram selo.
 */
export function publicInspectionBadge(value: string | null | undefined) {
  const note = publicInspectionNote(value);
  if (!note || note === STORE_INSPECTION_NOTE) return null;
  return note;
}

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
  const inspectionNote = publicInspectionNote(vehicle.inspection);
  if (inspectionNote) {
    rows.push({
      label: STORE_INSPECTION_LABEL,
      value: inspectionNote,
    });
  }

  return rows;
}
