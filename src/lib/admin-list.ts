/** Texto e regras de apresentação da lista de veículos no painel. */

import { formatNumberBR } from "@/lib/format";
import { formatTransmissionLabel } from "@/lib/vehicle-display";
import { vehicleLocationLabel } from "@/lib/vehicle-location";

/**
 * Uma linha só no card: ano · km · câmbio · cidade.
 * Versão, cor, placa, loja, chave e manual ficam no editar/operação.
 */
export function adminCardMetaLine(vehicle: {
  year: number;
  yearModel: number;
  km: number;
  transmission?: string | null;
  locationCity?: string | null;
}) {
  const parts: string[] = [`${vehicle.year}/${vehicle.yearModel}`];
  if (Number.isFinite(vehicle.km)) {
    parts.push(`${formatNumberBR(vehicle.km)} km`);
  }
  const gear = vehicle.transmission
    ? formatTransmissionLabel(vehicle.transmission)
    : "";
  if (gear) parts.push(gear);
  const city = vehicleLocationLabel(vehicle.locationCity);
  if (city) parts.push(city);
  return parts.join(" · ");
}

/** O card mostra um caminho de venda. Reservar e desfazer ficam no menu. */
export function adminCardShowsSoldAction(status: string) {
  return status === "disponivel" || status === "reservado";
}

export function adminCardOverflowStatuses(status: string) {
  const options: { value: "disponivel" | "reservado"; label: string }[] = [];
  if (status !== "disponivel") {
    options.push({
      value: "disponivel",
      label: "Voltar para disponível",
    });
  }
  if (status !== "reservado") {
    options.push({ value: "reservado", label: "Marcar reservado" });
  }
  return options;
}

/** Ações que saíram da faixa do card e continuam no menu ⋯. */
export const ADMIN_CARD_OVERFLOW_ACTIONS = [
  "operacao",
  "site",
  "destacar",
  "duplicar",
  "excluir",
] as const;

export type AdminCardOverflowAction =
  (typeof ADMIN_CARD_OVERFLOW_ACTIONS)[number];

export function deleteRequiresTypedConfirm(input: {
  photoCount?: number;
  status?: string;
}) {
  return (input.photoCount ?? 0) > 0 || input.status === "vendido";
}

export const DELETE_CONFIRM_PHRASE = "EXCLUIR";
