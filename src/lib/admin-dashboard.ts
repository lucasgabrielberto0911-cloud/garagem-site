/** Pendências e resumos da Central da loja — sem prisma, testável. */
import { reservationDeadline } from "@/lib/admin-date";
import { moneySum } from "@/lib/admin-money";
import { publishMissingItems } from "@/lib/stock-quality";
import { buildVehicleFullLabel } from "@/lib/vehicle-display";
import {
  expectedMargin,
  hasCostBasis,
  investedTotal,
} from "@/lib/vehicle-ops";

type VehicleRef = { id: string; brand: string; model: string };

/** Mínimo recomendado de fotos para um anúncio de veículo. */
export const MIN_GOOD_PHOTOS = 6;

export type StockCapitalVehicleInput = {
  price: number;
  purchasePrice: number | null | undefined;
  consigned: boolean;
  km: number;
  costsTotal: number;
  status?: string;
  historical?: boolean | null;
};

export type StockCapitalSummary = {
  activeCount: number;
  ownedCount: number;
  consignedCount: number;
  stockValue: number;
  investedTotal: number;
  potentialProfit: number;
  withCostBasisCount: number;
  missingPurchaseCount: number;
  averagePrice: number;
  averageKm: number;
};

/**
 * Soma (preço - compra - custos) dos veículos disponíveis e reservados
 * com preço de compra informado, excluindo consignados.
 */
export function summarizeStockCapital(
  vehicles: readonly StockCapitalVehicleInput[],
): StockCapitalSummary {
  let activeCount = 0;
  let ownedCount = 0;
  let consignedCount = 0;
  let totalKm = 0;
  let kmCount = 0;
  const saleValues: number[] = [];
  const investedValues: number[] = [];
  const profitValues: number[] = [];
  let withCostBasisCount = 0;
  let missingPurchaseCount = 0;

  for (const vehicle of vehicles) {
    if (vehicle.historical === true) continue;
    if (
      vehicle.status &&
      vehicle.status !== "disponivel" &&
      vehicle.status !== "reservado"
    ) {
      continue;
    }

    activeCount += 1;
    if (vehicle.km > 0) {
      totalKm += vehicle.km;
      kmCount += 1;
    }

    if (vehicle.consigned) {
      consignedCount += 1;
      continue;
    }

    ownedCount += 1;
    if (vehicle.price > 0) {
      saleValues.push(vehicle.price);
    }

    const hasPurchase = hasCostBasis(vehicle.purchasePrice, vehicle.costsTotal);
    if (!hasPurchase) {
      missingPurchaseCount += 1;
      continue;
    }

    const invested = investedTotal(vehicle.purchasePrice, vehicle.costsTotal, {
      consigned: false,
    });
    if (invested > 0) {
      investedValues.push(invested);
    }

    if (vehicle.price > 0) {
      withCostBasisCount += 1;
      profitValues.push(
        expectedMargin(vehicle.price, vehicle.purchasePrice, vehicle.costsTotal),
      );
    }
  }

  const stockValue = moneySum(saleValues);
  return {
    activeCount,
    ownedCount,
    consignedCount,
    stockValue,
    investedTotal: moneySum(investedValues),
    potentialProfit: moneySum(profitValues),
    withCostBasisCount,
    missingPurchaseCount,
    averagePrice: saleValues.length > 0 ? stockValue / saleValues.length : 0,
    averageKm: kmCount > 0 ? totalKm / kmCount : 0,
  };
}

export type VehiclePendingCandidate = {
  id: string;
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  status: string;
  historical?: boolean | null;
  price: number;
  purchasePrice: number | null;
  consigned: boolean;
  description?: string | null;
  photoCount: number;
  reservationExpiresAt?: string | null;
};

export type PendingBadge = {
  label: string;
  tone: "brand" | "neutral";
};

export type CentralPendingItem = {
  key: string;
  title: string;
  badges: PendingBadge[];
  href: string;
  priority: number;
};

export type CentralPendingSummary = {
  total: number;
  items: CentralPendingItem[];
};

/**
 * Monta as pendências acionáveis dos carros disponíveis/reservados
 * reaproveitando `publishMissingItems` (`stock-quality.ts`), mais
 * vendido sem venda registrada e reserva vencendo (nunca mostra cliente).
 */
export function buildVehiclePendingList(
  input: {
    vehicles: readonly VehiclePendingCandidate[];
    saleGaps?: readonly VehicleRef[];
    usingSeedPassword?: boolean;
  },
  limit = 5,
): CentralPendingSummary {
  const rows: CentralPendingItem[] = [];

  if (input.usingSeedPassword) {
    rows.push({
      key: "seed-password",
      title: "Senha padrão de acesso ao painel",
      badges: [{ label: "Trocar senha", tone: "brand" }],
      href: "/admin/conta",
      priority: 100,
    });
  }

  for (const gap of input.saleGaps ?? []) {
    rows.push({
      key: `sale-gap-${gap.id}`,
      title: `${gap.brand} ${gap.model}`,
      badges: [{ label: "Vendido sem venda", tone: "brand" }],
      href: `/admin/vendas/nova?veiculo=${encodeURIComponent(gap.id)}`,
      priority: 95,
    });
  }

  for (const vehicle of input.vehicles) {
    if (vehicle.historical === true) continue;
    if (vehicle.status !== "disponivel" && vehicle.status !== "reservado") {
      continue;
    }

    const baseMissing = publishMissingItems({
      status: vehicle.status,
      photoCount: vehicle.photoCount,
      price: vehicle.price,
    });

    const missingPhoto = baseMissing.some((item) => item.id === "fotos");
    const missingPrice = baseMissing.some((item) => item.id === "preco");
    const fewPhotos =
      !missingPhoto && vehicle.photoCount > 0 && vehicle.photoCount < MIN_GOOD_PHOTOS;
    const missingDescription = !vehicle.description?.trim();
    const missingPurchase =
      !vehicle.consigned &&
      !hasCostBasis(vehicle.purchasePrice, 0, { consigned: vehicle.consigned });
    const deadlineLabel =
      vehicle.status === "reservado"
        ? reservationDeadline(vehicle.reservationExpiresAt ?? null)
        : null;

    const badges: PendingBadge[] = [];
    let priority = 0;

    if (deadlineLabel) {
      badges.push({
        label:
          deadlineLabel === "Vence hoje"
            ? "Reserva vence hoje"
            : deadlineLabel,
        tone: "brand",
      });
      priority += 90;
    }
    if (missingPhoto) {
      badges.push({ label: "Sem foto", tone: "brand" });
      priority += 80;
    }
    if (missingPrice) {
      badges.push({ label: "Sem preço", tone: "brand" });
      priority += 70;
    }
    if (fewPhotos) {
      badges.push({ label: "Poucas fotos", tone: "neutral" });
      priority += 40;
    }
    if (missingDescription) {
      badges.push({ label: "Sem legenda", tone: "neutral" });
      priority += 35;
    }
    if (missingPurchase) {
      badges.push({ label: "Sem compra", tone: "neutral" });
      priority += 25;
    }

    if (badges.length === 0) continue;

    const encodedId = encodeURIComponent(vehicle.id);
    const href =
      missingPhoto || fewPhotos
        ? `/admin/veiculos/${encodedId}?view=fotos`
        : missingPrice || deadlineLabel
          ? `/admin/veiculos/${encodedId}#essencial`
          : missingDescription
            ? `/admin/veiculos/${encodedId}#itens`
            : `/admin/veiculos/${encodedId}?view=operacao`;

    rows.push({
      key: `vehicle-${vehicle.id}`,
      title: buildVehicleFullLabel(vehicle),
      badges,
      href,
      priority,
    });
  }

  rows.sort(
    (a, b) =>
      b.priority - a.priority || a.title.localeCompare(b.title, "pt-BR"),
  );

  return {
    total: rows.length,
    items: rows.slice(0, Math.max(0, limit)),
  };
}
