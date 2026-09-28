import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { PUBLIC_VEHICLE_CARD_SELECT } from "@/lib/public-stock";
import type { VehicleCardRecord } from "@/lib/stock-query";

const PUBLIC_VEHICLE_CARD_SELECT_NO_CITY = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  km: true,
  price: true,
  transmission: true,
  fuel: true,
  status: true,
  featured: true,
  color: true,
  updatedAt: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
} as const;

const PUBLIC_VEHICLE_CARD_SELECT_LEGACY = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  km: true,
  price: true,
  transmission: true,
  fuel: true,
  status: true,
  featured: true,
  color: true,
  updatedAt: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true },
  },
} as const;

type CardQuery = Omit<Parameters<typeof prisma.vehicle.findMany>[0], "select">;

function withCardDefaults(
  row: {
    photos: Array<{ url: string; thumbnailUrl?: string | null }>;
    locationCity?: string | null;
  },
  extras: { locationCity: string | null; thumbnailUrl: string | null | undefined },
): VehicleCardRecord {
  return {
    ...(row as VehicleCardRecord),
    locationCity:
      "locationCity" in row && row.locationCity != null
        ? row.locationCity
        : extras.locationCity,
    photos: row.photos.map((photo) => ({
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl ?? extras.thumbnailUrl ?? null,
    })),
  };
}

/**
 * Card público com fallback se `locationCity` ou `thumbnailUrl` ainda não
 * existirem no banco. Não consulta placa, FIPE nem documentos.
 */
export async function queryPublicVehicleCards(
  args: CardQuery,
): Promise<VehicleCardRecord[]> {
  try {
    const rows = await prisma.vehicle.findMany({
      ...args,
      select: PUBLIC_VEHICLE_CARD_SELECT,
    });
    return rows.map((row) =>
      withCardDefaults(row, { locationCity: row.locationCity, thumbnailUrl: null }),
    );
  } catch (error) {
    if (isMissingColumnError(error, "locationCity")) {
      try {
        const rows = await prisma.vehicle.findMany({
          ...args,
          select: PUBLIC_VEHICLE_CARD_SELECT_NO_CITY,
        });
        return rows.map((row) =>
          withCardDefaults(row, { locationCity: null, thumbnailUrl: null }),
        );
      } catch (inner) {
        if (!isMissingColumnError(inner, "thumbnailUrl")) throw inner;
        return queryLegacyCards(args);
      }
    }
    if (!isMissingColumnError(error, "thumbnailUrl")) throw error;
    return queryLegacyCards(args);
  }
}

async function queryLegacyCards(args: CardQuery): Promise<VehicleCardRecord[]> {
  const rows = await prisma.vehicle.findMany({
    ...args,
    select: PUBLIC_VEHICLE_CARD_SELECT_LEGACY,
  });
  return rows.map((row) =>
    withCardDefaults(
      { ...row, photos: row.photos.map((photo) => ({ url: photo.url })) },
      { locationCity: null, thumbnailUrl: null },
    ),
  );
}
