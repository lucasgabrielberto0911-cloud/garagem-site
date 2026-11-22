import { businessPeriodStart, localDateInput } from "@/lib/admin-date";
import { unstable_cache } from "next/cache";
import bcrypt from "bcryptjs";
import {
  ADMIN_DATA_TAG,
  ADMIN_SEED_PASSWORD_TAG,
} from "@/lib/admin-cache";
import {
  buildVehiclePendingList,
  summarizeStockCapital,
} from "@/lib/admin-dashboard";
import { WEAK_ADMIN_PASSWORDS } from "@/lib/admin-security";
import { summarizeStockAge } from "@/lib/admin-stock-age";
import { prisma } from "@/lib/prisma";
import { computeMonthlySalesGoal } from "@/lib/sales-goals";
import { extrasTotal } from "@/lib/vehicle-ops";

export { daysInStock, STALE_DAYS } from "@/lib/stock-quality";

/** Apenas alerta informativo: nunca participa da autenticação. */
export const getAdminWeakPasswordAlert = unstable_cache(
  async (_adminId: string, passwordHash: string) => {
    return (
      await Promise.all(
        WEAK_ADMIN_PASSWORDS.map((password) =>
          bcrypt.compare(password, passwordHash),
        ),
      )
    ).some(Boolean);
  },
  ["admin-password-alert-v1"],
  { revalidate: 60, tags: [ADMIN_SEED_PASSWORD_TAG] },
);

export async function getUsingSeedPassword() {
  try {
    const admins = await prisma.admin.findMany({
      select: { id: true, passwordHash: true },
    });
    return (
      await Promise.all(
        admins.map((admin) =>
          getAdminWeakPasswordAlert(admin.id, admin.passwordHash),
        ),
      )
    ).some(Boolean);
  } catch {
    return null;
  }
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;

/**
 * Dados da Central da loja: tudo em um Promise.all, sem N+1,
 * sem placa/chassi/RENAVAM e sem consultas de leads, agenda ou placar.
 */
async function loadDashboardData() {
  const failures: string[] = [];
  const now = new Date();
  const monthStart = businessPeriodStart("month", now);

  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T) => {
    try {
      return await fn();
    } catch (error) {
      failures.push(label);
      console.error(`[central] ${label}:`, error);
      return fallback;
    }
  };

  const [
    activeVehicles,
    acquisitionDates,
    featured,
    monthSales,
    monthlySales,
    saleGaps,
    usingSeedPassword,
  ] = await Promise.all([
    safe(
      "activeVehicles",
      () =>
        prisma.vehicle.findMany({
          where: {
            historical: false,
            status: { in: ["disponivel", "reservado"] },
          },
          select: {
            id: true,
            brand: true,
            model: true,
            version: true,
            yearModel: true,
            status: true,
            price: true,
            purchasePrice: true,
            consigned: true,
            km: true,
            description: true,
            createdAt: true,
            _count: { select: { photos: true } },
            costs: { select: { amount: true } },
            reservations: {
              where: { status: "ativa" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { expiresAt: true },
            },
          },
        }),
      [],
    ),
    safe(
      "acquisitionDates",
      () =>
        prisma.vehicleAcquisitionMetadata.findMany({
          where: {
            stockEnteredAt: { not: null },
            vehicle: { historical: false, status: "disponivel" },
          },
          select: { vehicleId: true, stockEnteredAt: true },
        }),
      [],
    ),
    safe(
      "featured",
      () =>
        prisma.vehicle.count({
          where: { historical: false, status: "disponivel", featured: true },
        }),
      0,
    ),
    safe(
      "monthSales",
      () =>
        prisma.sale.aggregate({
          where: { saleDate: { gte: monthStart } },
          _sum: { salePrice: true },
          _count: { _all: true },
        }),
      { _sum: { salePrice: null }, _count: { _all: 0 } },
    ),
    safe(
      "monthlySales",
      async () => {
        const start = businessPeriodStart("month", now);
        start.setUTCMonth(start.getUTCMonth() - 5);
        const rows = await prisma.$queryRaw<
          Array<{ key: string; revenue: number; count: number }>
        >`
        SELECT to_char("saleDate" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS key,
          SUM(round("salePrice"::numeric, 2))::double precision AS revenue, COUNT(*)::int AS count
        FROM "Sale" WHERE "saleDate" >= ${start} GROUP BY 1`;
        const months = Array.from({ length: 6 }, (_, i) => {
          const date = new Date(start);
          date.setUTCMonth(start.getUTCMonth() + i);
          return {
            key: localDateInput(date).slice(0, 7),
            revenue: 0,
            count: 0,
          };
        });
        for (const row of rows) {
          const month = months.find((m) => m.key === row.key);
          if (month) {
            month.revenue = row.revenue;
            month.count = row.count;
          }
        }
        return months;
      },
      [] as Array<{ key: string; revenue: number; count: number }>,
    ),
    safe(
      "saleGaps",
      () =>
        prisma.vehicle.findMany({
          where: { status: "vendido", historical: false, sale: null },
          take: 5,
          select: { id: true, brand: true, model: true },
        }),
      [],
    ),
    safe(
      "usingSeedPassword",
      async () => {
        const value = await getUsingSeedPassword();
        if (value === null)
          throw new Error("Não foi possível conferir os acessos.");
        return value;
      },
      false,
    ),
  ]);

  const enteredAtMap = new Map<string, Date>();
  for (const row of acquisitionDates) {
    if (row.stockEnteredAt) enteredAtMap.set(row.vehicleId, row.stockEnteredAt);
  }

  const stockCapital = summarizeStockCapital(
    activeVehicles.map((vehicle) => ({
      price: vehicle.price,
      purchasePrice: vehicle.purchasePrice,
      consigned: vehicle.consigned,
      km: vehicle.km,
      status: vehicle.status,
      costsTotal: extrasTotal(vehicle.costs),
    })),
  );

  const stockAge = summarizeStockAge(
    activeVehicles.map((vehicle) => ({
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      yearModel: vehicle.yearModel,
      status: vehicle.status,
      createdAt: vehicle.createdAt,
      stockEnteredAt: enteredAtMap.get(vehicle.id) ?? null,
    })),
    now,
  );

  const pendencies = buildVehiclePendingList({
    usingSeedPassword,
    saleGaps,
    vehicles: activeVehicles.map((vehicle) => ({
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      yearModel: vehicle.yearModel,
      status: vehicle.status,
      price: vehicle.price,
      purchasePrice: vehicle.purchasePrice,
      consigned: vehicle.consigned,
      description: vehicle.description,
      photoCount: vehicle._count.photos,
      reservationExpiresAt:
        vehicle.reservations[0]?.expiresAt?.toISOString() ?? null,
    })),
  });

  const monthCount = monthSales._count._all;
  const monthRevenue = monthSales._sum.salePrice ?? 0;

  return {
    failures,
    updatedAt: now.toISOString(),
    pendencies,
    stockAge,
    stockCapital,
    featured,
    monthlySales,
    salesGoal: computeMonthlySalesGoal({
      salesCount: monthCount,
      salesRevenue: monthRevenue,
    }),
    monthTicket: monthCount > 0 ? monthRevenue / monthCount : 0,
  };
}

const getDashboardDataForDay = unstable_cache(
  async (_day: string) => loadDashboardData(),
  ["admin-dashboard-v8"],
  { revalidate: 60, tags: [ADMIN_DATA_TAG] },
);

/** O dia na chave também renova alertas, idade e período do mês na virada local. */
export function getDashboardData() {
  return getDashboardDataForDay(localDateInput());
}
