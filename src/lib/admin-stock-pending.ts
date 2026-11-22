import type { Prisma } from "@prisma/client";
import { PARKED_MIN_DAYS, parkedCutoffDate } from "@/lib/admin-parados";
import { staleCutoffDate } from "@/lib/stock-quality";

/** Mínimo de fotos esperado na lista de veículos antes de sinalizar pendência. */
export const MIN_LIST_PHOTOS = 5;

export type StockPending =
  | "sem-fotos"
  | "sem-preco"
  | "antigos"
  | "com-pendencia"
  | "parados"
  | "";

export function parseStockPending(value?: string | null): StockPending {
  if (
    value === "sem-fotos" ||
    value === "sem-preco" ||
    value === "antigos" ||
    value === "com-pendencia" ||
    value === "parados"
  ) {
    return value;
  }
  return "";
}

export function stockPendingWhere(
  pending: StockPending,
  now: Date = new Date(),
): Prisma.VehicleWhereInput {
  if (pending === "sem-fotos") return { photos: { none: {} } };
  if (pending === "sem-preco") return { price: { lte: 0 } };
  if (pending === "antigos") {
    return { status: "disponivel", createdAt: { lt: staleCutoffDate() } };
  }
  if (pending === "parados") {
    return {
      status: "disponivel",
      createdAt: { lte: parkedCutoffDate(PARKED_MIN_DAYS, now) },
    };
  }
  return {};
}

export type VehiclePendingBadgeId =
  | "sem-preco"
  | "sem-foto"
  | "poucas-fotos"
  | "sem-descricao"
  | "sem-capa";

export type VehiclePendingBadge = {
  id: VehiclePendingBadgeId;
  label: string;
  tone: "brand" | "neutral";
};

export type VehiclePendingBadgeInput = {
  status: string;
  price: number;
  photoCount: number;
  hasCover: boolean;
  hasDescription: boolean;
};

/**
 * Selos de pendência da lista de Veículos.
 * Só devolve selo quando falta algo; carro completo ou vendido devolve [].
 */
export function vehiclePendingBadges(
  input: VehiclePendingBadgeInput,
): VehiclePendingBadge[] {
  if (input.status === "vendido") return [];

  const badges: VehiclePendingBadge[] = [];

  if (!Number.isFinite(input.price) || input.price <= 0) {
    badges.push({ id: "sem-preco", label: "Sem preço", tone: "brand" });
  }

  const photoCount = Math.max(0, Math.trunc(input.photoCount || 0));
  if (photoCount === 0) {
    badges.push({ id: "sem-foto", label: "Sem foto", tone: "brand" });
  } else {
    if (!input.hasCover) {
      badges.push({ id: "sem-capa", label: "Sem capa", tone: "brand" });
    }
    if (photoCount < MIN_LIST_PHOTOS) {
      badges.push({
        id: "poucas-fotos",
        label: "Poucas fotos",
        tone: "neutral",
      });
    }
  }

  if (!input.hasDescription) {
    badges.push({
      id: "sem-descricao",
      label: "Sem descrição",
      tone: "neutral",
    });
  }

  return badges;
}
