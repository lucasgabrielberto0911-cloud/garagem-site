import { unstable_cache } from "next/cache";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";
import { localDateInput } from "@/lib/admin-date";
import {
  filterParkedVehicles,
  PARKED_MIN_DAYS,
  PARKED_VEHICLE_SELECT,
  SITE_VISIT_ACTION,
  SITE_WHATSAPP_ACTION,
  type ParkedVehicleItem,
} from "@/lib/admin-parados";
import {
  summarizeStockAge,
  type StockAgeBandId,
} from "@/lib/admin-stock-age";
import { prisma } from "@/lib/prisma";

export type ParkedVehiclesReport = {
  items: ParkedVehicleItem[];
  bandCounts: Record<StockAgeBandId, number>;
  totalActive: number;
  totalValue: number;
  viewsAvailable: boolean;
  updatedAt: string;
};

type ParkedFunnelAction =
  | typeof SITE_VISIT_ACTION
  | typeof SITE_WHATSAPP_ACTION;

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
        fipePrice?: number | null;
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
      by: ["entityId", "action"];
      where: {
        entityId: { in: string[] };
        action: { in: ParkedFunnelAction[] };
      };
      _count: { _all: true };
    }) => Promise<
      Array<{ entityId: string; action: string; _count: { _all: number } }>
    >;
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

  const ageSummary = summarizeStockAge(candidates, now, 0);
  const bandCounts: Record<StockAgeBandId, number> = {
    "0-30": 0,
    "31-45": 0,
    "46-60": 0,
    "60+": 0,
  };
  for (const band of ageSummary.bands) {
    bandCounts[band.id] = band.count;
  }

  const preliminary = filterParkedVehicles(candidates, {
    now,
    minDays: PARKED_MIN_DAYS,
  });
  const parkedIds = preliminary.map((item) => item.id);

  let viewsAvailable = true;
  const viewsByVehicleId = new Map<string, number>();
  const whatsappByVehicleId = new Map<string, number>();

  if (parkedIds.length > 0) {
    try {
      const auditGroups = await db.adminAudit.groupBy({
        by: ["entityId", "action"],
        where: {
          entityId: { in: parkedIds },
          action: { in: [SITE_VISIT_ACTION, SITE_WHATSAPP_ACTION] },
        },
        _count: { _all: true },
      });
      for (const group of auditGroups) {
        if (group.action === SITE_VISIT_ACTION) {
          viewsByVehicleId.set(group.entityId, group._count._all);
        } else if (group.action === SITE_WHATSAPP_ACTION) {
          whatsappByVehicleId.set(group.entityId, group._count._all);
        }
      }
    } catch (error) {
      viewsAvailable = false;
      console.error("[admin-parados] Falha ao consultar métricas do site:", error);
    }
  }

  const items = filterParkedVehicles(candidates, {
    now,
    minDays: PARKED_MIN_DAYS,
    viewsByVehicleId,
    whatsappByVehicleId,
  });

  const totalValue = items.reduce(
    (sum, item) => sum + (item.price > 0 ? item.price : 0),
    0,
  );

  return {
    items,
    bandCounts,
    totalActive: ageSummary.totalActive,
    totalValue,
    viewsAvailable,
    updatedAt: now.toISOString(),
  };
}

const getCachedParkedVehicles = unstable_cache(
  async (_day: string) => loadParkedVehicles(),
  ["admin-parked-vehicles-v2"],
  { revalidate: 60, tags: [ADMIN_DATA_TAG] },
);

export function getAdminParkedVehicles() {
  return getCachedParkedVehicles(localDateInput());
}
