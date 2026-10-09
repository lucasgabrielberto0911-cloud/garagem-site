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
    photos: row.photos.map((photo) => ({
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl ?? null,
    })),
  };
}

/** Card público sem cidade do veículo, placa, FIPE ou documentos. */
export async function queryPublicVehicleCards(
  args: CardQuery,
): Promise<VehicleCardRecord[]> {
  try {
    const rows = await prisma.vehicle.findMany({
      ...args,
      select: PUBLIC_VEHICLE_CARD_SELECT,
    });
    return rows.map(withCardDefaults);
  } catch (error) {
    if (!isMissingColumnError(error, "thumbnailUrl")) throw error;
    const rows = await prisma.vehicle.findMany({
      ...args,
      select: PUBLIC_VEHICLE_CARD_SELECT_LEGACY,
    });
    return rows.map(withCardDefaults);
  }
}
