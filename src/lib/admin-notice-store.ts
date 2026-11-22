import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { ADMIN_DATA_TAG } from "./admin-cache";
import { MISSING_SALE_COST_WHERE } from "./admin-cost-warnings";
import { localDateInput } from "./admin-date";

export function reservationDueCutoff(now = new Date()) {
  return new Date(`${localDateInput(now)}T23:59:59.999-03:00`);
}

export function missingCarNoticeWhere(dueBefore: Date) {
  return {
    historical: false,
    status: { in: ["disponivel", "reservado"] },
    OR: [
      { photos: { none: {} } },
      { price: { lte: 0 } },
      {
        status: "reservado",
        reservations: {
          some: {
            status: "ativa",
            expiresAt: { lte: dueBefore },
          },
        },
      },
    ],
  };
}

const loadNoticeSnapshot = unstable_cache(
  async (day: string) => {
    const dueBefore = new Date(`${day}T23:59:59.999-03:00`);
    const [carros, vendas] = await Promise.all([
      prisma.vehicle.count({ where: missingCarNoticeWhere(dueBefore) }),
      prisma.sale.count({ where: MISSING_SALE_COST_WHERE }),
    ]);
    return {
      counts: { carros, vendas },
    };
  },
  ["admin-notice-snapshot-v3"],
  { revalidate: 15, tags: [ADMIN_DATA_TAG] },
);

export function getAdminNoticeSnapshot(now = new Date()) {
  return loadNoticeSnapshot(localDateInput(now));
}
