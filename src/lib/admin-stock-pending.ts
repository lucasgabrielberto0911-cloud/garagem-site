import type { Prisma } from "@prisma/client";
import { MIN_GOOD_PHOTOS } from "@/lib/admin-dashboard";
import { PARKED_MIN_DAYS, parkedCutoffDate } from "@/lib/admin-parados";
import { publishMissingItems, staleCutoffDate } from "@/lib/stock-quality";
import { hasCostBasis } from "@/lib/vehicle-ops";

export { MIN_GOOD_PHOTOS };

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
  | "sem-legenda"
  | "sem-capa"
  | "sem-compra";

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
  purchasePrice?: number | null;
  consigned?: boolean;
};

/**
 * Selos de pendência da lista de Veículos.
 * Reutiliza a mesma regra da Central (`MIN_GOOD_PHOTOS`, `publishMissingItems` e `hasCostBasis`).
 * Só devolve selo quando falta algo; carro completo ou vendido devolve [].
 */
export function vehiclePendingBadges(
  input: VehiclePendingBadgeInput,
): VehiclePendingBadge[] {
  if (input.status !== "disponivel" && input.status !== "reservado") {
    return [];
  }

  const photoCount = Math.max(0, Math.trunc(input.photoCount || 0));
  const baseMissing = publishMissingItems({
    status: input.status,
    photoCount,
    price: input.price,
  });
  const missingPrice = baseMissing.some((item) => item.id === "preco");
  const missingPhoto = baseMissing.some((item) => item.id === "fotos");
  const missingPurchase =
    !input.consigned &&
    !hasCostBasis(input.purchasePrice, 0, { consigned: input.consigned });

  const badges: VehiclePendingBadge[] = [];

  if (missingPrice) {
    badges.push({ id: "sem-preco", label: "Sem preço", tone: "brand" });
  }

  if (missingPhoto) {
    badges.push({ id: "sem-foto", label: "Sem foto", tone: "brand" });
  } else {
    if (!input.hasCover) {
      badges.push({ id: "sem-capa", label: "Sem capa", tone: "brand" });
    }
    if (photoCount < MIN_GOOD_PHOTOS) {
      badges.push({
        id: "poucas-fotos",
        label: "Poucas fotos",
        tone: "neutral",
      });
    }
  }

  if (!input.hasDescription) {
    badges.push({
      id: "sem-legenda",
      label: "Sem legenda",
      tone: "neutral",
    });
  }

  if (missingPurchase) {
    badges.push({
      id: "sem-compra",
      label: "Sem compra",
      tone: "neutral",
    });
  }

  return badges;
}
