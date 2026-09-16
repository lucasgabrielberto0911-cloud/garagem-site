/** Linha de varredura do lote no painel: ano, km, câmbio, cor, placa. */

import { formatNumberBR, formatPlateDisplay } from "@/lib/format";
import {
  formatColorLabel,
  formatTransmissionLabel,
} from "@/lib/vehicle-display";

export type AdminListScanInput = {
  year: number;
  yearModel: number;
  km: number;
  transmission?: string | null;
  color?: string | null;
  plate?: string | null;
  updatedAt?: Date | string | null;
};

export function adminListScanParts(vehicle: AdminListScanInput) {
  const parts: string[] = [`${vehicle.year}/${vehicle.yearModel}`];
  if (Number.isFinite(vehicle.km)) {
    parts.push(`${formatNumberBR(vehicle.km)} km`);
  }
  const gear = vehicle.transmission
    ? formatTransmissionLabel(vehicle.transmission)
    : "";
  if (gear) parts.push(gear);
  const color = formatColorLabel(vehicle.color);
  if (color) parts.push(color);
  const plate = vehicle.plate?.trim()
    ? formatPlateDisplay(vehicle.plate)
    : "";
  if (plate) parts.push(plate);
  return parts;
}

export function adminListScanLine(vehicle: AdminListScanInput) {
  return adminListScanParts(vehicle).join(" · ");
}

export function deleteRequiresTypedConfirm(input: {
  photoCount?: number;
  status?: string;
}) {
  return (input.photoCount ?? 0) > 0 || input.status === "vendido";
}

export const DELETE_CONFIRM_PHRASE = "EXCLUIR";
