import { unstable_cache } from "next/cache";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";
import { localDateInput } from "@/lib/admin-date";
import {
  filterParkedVehicles,
  PARKED_MIN_DAYS,
  PARKED_VEHICLE_SELECT,
  SITE_VISIT_ACTION,
  type ParkedVehicleItem,
} from "@/lib/admin-parados";
import { prisma } from "@/lib/prisma";

export type ParkedVehiclesReport = {
  items: ParkedVehicleItem[];
  totalValue: number;
  viewsAvailable: boolean;
  updatedAt: string;
};

type ParkedStoreDb = {
  vehicle: {
    findMany: (args: {
      where: { status: string; historical: boolean };
      select: typeof PARKED_VEHICLE_SELECT;
    }) => Promise<
      Array<{
        id: string;
        brand: string;
        model: string;
        version: string | null;
        yearModel: number;
        price: number;
        status: string;
        historical: boolean;
        createdAt: Date;
      }>
    >;
  };
  vehicleAcquisitionMetadata?: {
    findMany: (args: {
      where: { vehicleId: { in: string[] }; stockEnteredAt: { not: null } };
      select: { vehicleId: true; stockEnteredAt: true };
    }) => Promise<Array<{ vehicleId: string; stockEnteredAt: Date | null }>>;
  };
  adminAudit: {
    groupBy: (args: {
      by: ["entityId"];
      where: { entityId: { in: string[] }; action: typeof SITE_VISIT_ACTION };
      _count: { _all: true };
    }) => Promise<Array<{ entityId: string; _count: { _all: number } }>>;
  };
};

export async function loadParkedVehicles(
  db: ParkedStoreDb = prisma as unknown as ParkedStoreDb,
  now: Date = new Date(),
): Promise<ParkedVehiclesReport> {
  const vehicles = await db.vehicle.findMany({
    where: { status: "disponivel", historical: false },
    select: PARKED_VEHICLE_SELECT,
  });

  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const enteredMap = new Map<string, Date>();

  if (vehicleIds.length > 0 && db.vehicleAcquisitionMetadata) {
    try {
      const metadataRows = await db.vehicleAcquisitionMetadata.findMany({
        where: { vehicleId: { in: vehicleIds }, stockEnteredAt: { not: null } },
        select: { vehicleId: true, stockEnteredAt: true },
      });
      for (const row of metadataRows) {
        if (row.stockEnteredAt) enteredMap.set(row.vehicleId, row.stockEnteredAt);
      }
    } catch {
      // Tabela opcional antes da migração do avaliador; usa createdAt normalmente.
    }
  }

  const candidates = vehicles.map((vehicle) => ({
    ...vehicle,
    stockEnteredAt: enteredMap.get(vehicle.id) ?? null,
  }));

  const preliminary = filterParkedVehicles(candidates, {
    now,
    minDays: PARKED_MIN_DAYS,
  });
  const parkedIds = preliminary.map((item) => item.id);

  let viewsAvailable = true;
  const viewsByVehicleId = new Map<string, number>();

  if (parkedIds.length > 0) {
    try {
      const auditGroups = await db.adminAudit.groupBy({
        by: ["entityId"],
        where: {
          entityId: { in: parkedIds },
          action: SITE_VISIT_ACTION,
        },
        _count: { _all: true },
      });
      for (const group of auditGroups) {
        viewsByVehicleId.set(group.entityId, group._count._all);
      }
    } catch (error) {
      viewsAvailable = false;
      console.error("[admin-parados] Falha ao consultar visualizações:", error);
    }
  }

  const items = filterParkedVehicles(candidates, {
    now,
    minDays: PARKED_MIN_DAYS,
    viewsByVehicleId,
  });

  const totalValue = items.reduce(
    (sum, item) => sum + (item.price > 0 ? item.price : 0),
    0,
  );

  return {
    items,
    totalValue,
    viewsAvailable,
    updatedAt: now.toISOString(),
  };
}

const getCachedParkedVehicles = unstable_cache(
  async (_day: string) => loadParkedVehicles(),
  ["admin-parked-vehicles-v1"],
  { revalidate: 60, tags: [ADMIN_DATA_TAG] },
);

export function getAdminParkedVehicles() {
  return getCachedParkedVehicles(localDateInput());
}
