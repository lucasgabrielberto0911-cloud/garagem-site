import { businessPeriodStart, localDateInput } from "@/lib/admin-date";
import { unstable_cache } from "next/cache";
import bcrypt from "bcryptjs";
import {
  ADMIN_DATA_TAG,
  ADMIN_NEW_LEADS_TAG,
  ADMIN_SEED_PASSWORD_TAG,
} from "@/lib/admin-cache";
import { WEAK_ADMIN_PASSWORDS } from "@/lib/admin-security";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import {
  DEFAULT_ABOUT,
  getPublicSite,
  listPlaceholderLabels,
} from "@/lib/site-settings";
import { getGoogleReviews } from "@/lib/site-content";
import {
  DEFAULT_GOOGLE_REVIEWS,
  googleReviewsReady,
} from "@/lib/google-reviews";
import { daysInStock, staleCutoffDate } from "@/lib/stock-quality";
import {
  computeMonthlySalesGoal,
  computeSalesLeaderboard,
} from "@/lib/sales-goals";

export { daysInStock, STALE_DAYS } from "@/lib/stock-quality";

/** Badge do menu: 15s de cache para não consultar o banco em toda navegação. */
export const getNewLeadsBadgeCount = unstable_cache(
  async () => {
    try {
      return await prisma.leadVenda.count({ where: { status: "novo" } });
    } catch {
      return null;
    }
  },
  ["admin-new-leads-badge"],
  { revalidate: 15, tags: [ADMIN_NEW_LEADS_TAG] },
);

/** Apenas alerta informativo: nunca participa da autenticação. O hash novo muda a chave imediatamente. */
export const getAdminWeakPasswordAlert = unstable_cache(
  async (_adminId: string, passwordHash: string) => {
    return (await Promise.all(WEAK_ADMIN_PASSWORDS.map(password => bcrypt.compare(password, passwordHash)))).some(Boolean);
  },
  ["admin-password-alert-v1"],
  { revalidate: 60, tags: [ADMIN_SEED_PASSWORD_TAG] },
);

/** O dashboard já tem cache; a lista de hashes atual evita alerta velho após troca. */
export async function getUsingSeedPassword() {
  try {
    const admins = await prisma.admin.findMany({ select: { id: true, passwordHash: true } });
    return (await Promise.all(admins.map(admin => getAdminWeakPasswordAlert(admin.id, admin.passwordHash)))).some(Boolean);
  } catch {
    return null;
  }
}

function startOfMonth() {
  return businessPeriodStart("month");
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;

/*
 * Tudo aqui precisa sobreviver ao JSON do cache (sem Date): por isso os
 * leads e os parados já saem com os campos que a tela usa.
 */
async function loadDashboardData() {
  const failures: string[] = [];
  const monthStart = startOfMonth();
  const staleBefore = staleCutoffDate();

  // Consultas isoladas: se uma tabela ainda não existir, o dashboard não cai inteiro.
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T) => {
    try {
      return await fn();
    } catch (error) {
      failures.push(label);
      console.error(`[dashboard] ${label}:`, error);
      return fallback;
    }
  };

  const [
    vehicleGroups,
    featured,
    availableByConsigned,
    salesAggregate,
    monthSales,
    leadGroups,
    recentLeads,
    recentVehicles,
    pendingCounts,
    monthlySales,
    saleGaps,
    dueLeads,
    unansweredLeads,
    reservedVehicles,
    monthSaleRecords,
    staleVehicles,
    withoutPhotos,
    publishedTestimonials,
    usingSeedPassword,
    publicSite,
    googleReviews,
  ] = await Promise.all([
    safe(
      "vehicle.groupBy",
      () =>
        prisma.vehicle.groupBy({
          where: { historical: false },
          by: ["status"],
          _count: { _all: true },
        }),
      [],
    ),
    safe(
      "featured",
      () =>
        prisma.vehicle.count({
          where: { status: "disponivel", featured: true },
        }),
      0,
    ),
    safe(
      "availableByConsigned",
      () =>
        prisma.vehicle.groupBy({
          by: ["consigned"],
          where: { status: "disponivel" },
          _sum: { price: true, km: true },
          _count: { _all: true },
        }),
      [],
    ),
    safe(
      "salesAggregate",
      () =>
        prisma.sale.aggregate({
          _sum: { salePrice: true },
          _count: { _all: true },
        }),
      { _sum: { salePrice: null }, _count: { _all: 0 } },
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
      "lead.groupBy",
      () =>
        prisma.leadVenda.groupBy({ by: ["status"], _count: { _all: true } }),
      [],
    ),
    safe(
      "recentLeads",
      () =>
        prisma.leadVenda.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleInfo: true,
            status: true,
          },
        }),
      [],
    ),
    safe(
      "recentVehicles",
      () =>
        prisma.vehicle.findMany({
          where: { historical: false },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            brand: true,
            model: true,
            version: true,
            yearModel: true,
            price: true,
            photos: {
              orderBy: { order: "asc" },
              take: 1,
              select: { url: true, thumbnailUrl: true },
            },
          },
        }),
      [],
    ),
    safe(
      "pendingCounts",
      async () => {
        const [counts] = await prisma.$queryRaw<Array<{ withoutPhotos: number; stale: number; missingSales: number }>>`
          SELECT count(*) FILTER (WHERE status IN ('disponivel', 'reservado')
            AND NOT EXISTS (SELECT 1 FROM "Photo" p WHERE p."vehicleId" = v.id))::int AS "withoutPhotos",
            count(*) FILTER (WHERE status = 'disponivel' AND "createdAt" < ${staleBefore})::int AS stale,
            count(*) FILTER (WHERE status = 'vendido'
            AND NOT EXISTS (SELECT 1 FROM "Sale" s WHERE s."vehicleId" = v.id))::int AS "missingSales"
          FROM "Vehicle" v WHERE historical = false
        `;
        return counts;
      },
      null as {
        withoutPhotos: number;
        stale: number;
        missingSales: number;
      } | null,
    ),
    safe(
      "monthlySales",
      async () => {
        const start = businessPeriodStart("month");
        start.setUTCMonth(start.getUTCMonth() - 5);
        // Prisma DateTime é timestamp sem fuso; os valores gravados representam UTC.
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
      "dueLeads",
      () =>
        prisma.leadVenda.findMany({
          where: {
            nextActionAt: { lte: new Date() },
            status: { notIn: ["fechado", "perdido"] },
          },
          orderBy: { nextActionAt: "asc" },
          take: 6,
          select: {
            id: true,
            name: true,
            phone: true,
            nextAction: true,
            nextActionAt: true,
            vehicleInfo: true,
          },
        }),
      [],
    ),
    safe(
      "unansweredLeads",
      () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return prisma.leadVenda.findMany({
          where: {
            status: "novo",
            createdAt: { lte: oneHourAgo },
          },
          orderBy: { createdAt: "asc" },
          take: 6,
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleInfo: true,
            createdAt: true,
          },
        });
      },
      [],
    ),
    safe(
      "reservedVehicles",
      () =>
        prisma.vehicle.findMany({
          where: { status: "reservado" },
          orderBy: { updatedAt: "asc" },
          take: 6,
          select: {
            id: true,
            brand: true,
            model: true,
            price: true,
            updatedAt: true,
          },
        }),
      [],
    ),
    safe(
      "monthSaleRecords",
      () =>
        prisma.sale.findMany({
          where: { saleDate: { gte: monthStart } },
          orderBy: { saleDate: "desc" },
          select: {
            id: true,
            salePrice: true,
            notes: true,
            saleDate: true,
          },
        }),
      [],
    ),
    safe(
      "staleVehicles",
      () =>
        prisma.vehicle.findMany({
          where: { status: "disponivel", createdAt: { lt: staleBefore } },
          orderBy: { createdAt: "asc" },
          take: 5,
          select: { id: true, brand: true, model: true, createdAt: true },
        }),
      [],
    ),
    safe(
      "withoutPhotos",
      () =>
        prisma.vehicle.findMany({
          where: { status: { not: "vendido" }, photos: { none: {} } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, brand: true, model: true },
        }),
      [],
    ),
    safe(
      "testimonials",
      () => prisma.testimonial.count({ where: { published: true } }),
      0,
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
    safe(
      "publicSite",
      () => getPublicSite(),
      null as Awaited<ReturnType<typeof getPublicSite>> | null,
    ),
    safe("googleReviews", () => getGoogleReviews(), DEFAULT_GOOGLE_REVIEWS),
  ]);

  const byStatus = (status: string) =>
    vehicleGroups.find((group) => group.status === status)?._count._all ?? 0;

  const leadsByStatus = Object.fromEntries(
    LEAD_STATUSES.map((status) => [
      status,
      leadGroups.find((group) => group.status === status)?._count._all ?? 0,
    ]),
  ) as Record<LeadStatus, number>;

  const available = byStatus("disponivel");
  // Consignado fica na vitrine (entra no KM médio), mas não no valor do estoque.
  const owned = availableByConsigned.find((group) => !group.consigned);
  const ownedAvailable = owned?._count._all ?? 0;
  const stockValue = owned?._sum.price ?? 0;
  const availableCount = availableByConsigned.reduce(
    (sum, group) => sum + group._count._all,
    0,
  );
  const availableKm = availableByConsigned.reduce(
    (sum, group) => sum + (group._sum.km ?? 0),
    0,
  );
  const siteDefaults = (await import("@/lib/site")).site;
  const siteForPlaceholders = publicSite ?? {
    ...siteDefaults,
    ...DEFAULT_ABOUT,
  };

  return {
    failures,
    updatedAt: new Date().toISOString(),
    pendingCounts,
    monthlySales,
    saleGaps,
    dueLeads,
    hoje: {
      dueLeads,
      unansweredLeads,
      reservedVehicles,
    },
    salesGoal: computeMonthlySalesGoal({
      salesCount: monthSales._count._all,
      salesRevenue: monthSales._sum.salePrice ?? 0,
    }),
    leaderboard: computeSalesLeaderboard(monthSaleRecords),
    vehicles: {
      total: vehicleGroups.reduce((sum, group) => sum + group._count._all, 0),
      available,
      reserved: byStatus("reservado"),
      sold: byStatus("vendido"),
      featured,
      stockValue,
      ownedAvailable,
      consignedAvailable: availableCount - ownedAvailable,
      averagePrice: ownedAvailable > 0 ? stockValue / ownedAvailable : 0,
      averageKm: availableCount > 0 ? availableKm / availableCount : 0,
    },
    sales: {
      count: salesAggregate._count._all,
      revenue: salesAggregate._sum.salePrice ?? 0,
      monthCount: monthSales._count._all,
      monthRevenue: monthSales._sum.salePrice ?? 0,
      ticket:
        salesAggregate._count._all > 0
          ? (salesAggregate._sum.salePrice ?? 0) / salesAggregate._count._all
          : 0,
    },
    leads: {
      byStatus: leadsByStatus,
      total: leadGroups.reduce((sum, group) => sum + group._count._all, 0),
      recent: recentLeads,
    },
    publishedTestimonials,
    recentVehicles,
    alerts: {
      staleVehicles: staleVehicles.map(({ createdAt, ...vehicle }) => ({
        ...vehicle,
        days: daysInStock(createdAt),
      })),
      withoutPhotos,
      noFeatured: available > 0 && featured === 0,
      noTestimonials: publishedTestimonials === 0,
      noGoogleReviews: !googleReviewsReady(googleReviews),
      usingSeedPassword,
      placeholders: listPlaceholderLabels(siteForPlaceholders),
    },
  };
}

/**
 * Consultas em série no pooler (connection_limit=1). Cache curto com tag:
 * as actions do painel chamam expireAdminData() e lead novo do site expira
 * pela tag do badge. Vídeo não entra: não vale uma leitura só para avisar.
 */
const getDashboardDataForDay = unstable_cache(
  async (_day: string) => loadDashboardData(),
  ["admin-dashboard-v5"],
  { revalidate: 60, tags: [ADMIN_DATA_TAG, ADMIN_NEW_LEADS_TAG] },
);

/** O dia na chave também renova alertas e período do mês na virada local. */
export function getDashboardData() {
  return getDashboardDataForDay(localDateInput());
}
