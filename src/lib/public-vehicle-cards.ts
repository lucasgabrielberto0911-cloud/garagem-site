import { vehicleIdsWithPriceDrop } from "@/lib/vehicle-price-history";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { PUBLIC_VEHICLE_CARD_SELECT } from "@/lib/public-stock";
import type { VehicleCardRecord } from "@/lib/stock-query";

const PUBLIC_VEHICLE_CARD_SELECT_LEGACY = {
  ...PUBLIC_VEHICLE_CARD_SELECT,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true },
  },
} as const;

type CardQuery = Omit<Parameters<typeof prisma.vehicle.findMany>[0], "select">;

function withCardDefaults(row: VehicleCardRecord): VehicleCardRecord {
  const { locationCity: internalCity, ...publicRow } = row;
  void internalCity;
  return {
    ...publicRow,
    createdAt: row.createdAt ?? new Date(0),
    photos: (row.photos ?? []).map((photo) => ({
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl ?? null,
    })),
  };
}

/** Card público sem cidade do veículo, placa, FIPE ou documentos. */
/** Preenche `priceDrop` (valor em R$) só com histórico real; tabela ausente = sem selo. */
async function withPriceDrops(cards: VehicleCardRecord[]) {
  const drops = await vehicleIdsWithPriceDrop(
    cards.filter((card) => card.status !== "vendido"),
  );
  if (drops.size === 0) return cards;
  return cards.map((card) => (drops.has(card.id) ? { ...card, priceDrop: drops.get(card.id) } : card));
}

/** Marca `catalog: false` em unidades consignadas sem expor o campo interno `consigned`. */
async function withCatalogFlag(cards: VehicleCardRecord[]) {
  const availableIds = cards
    .filter((card) => card.status === "disponivel")
    .map((card) => card.id);
  if (availableIds.length === 0) return cards;
  try {
    const consigned = await prisma.vehicle.findMany({
      where: { id: { in: availableIds }, consigned: true },
      select: { id: true },
    });
    if (consigned.length === 0) return cards;
    const consignedIds = new Set(consigned.map((row) => row.id));
    return cards.map((card) =>
      consignedIds.has(card.id) ? { ...card, catalog: false } : card,
    );
  } catch (error) {
    if (!isMissingColumnError(error, "consigned")) throw error;
    return cards;
  }
}

export async function queryPublicVehicleCards(
  args: CardQuery,
): Promise<VehicleCardRecord[]> {
  try {
    const rows = await prisma.vehicle.findMany({
      ...args,
      select: PUBLIC_VEHICLE_CARD_SELECT,
    });
    return withCatalogFlag(await withPriceDrops(rows.map(withCardDefaults)));
  } catch (error) {
    if (!isMissingColumnError(error, "thumbnailUrl")) throw error;
    const rows = await prisma.vehicle.findMany({
      ...args,
      select: PUBLIC_VEHICLE_CARD_SELECT_LEGACY,
    });
    return withCatalogFlag(await withPriceDrops(rows.map(withCardDefaults)));
  }
}
