import { unstable_cache } from "next/cache";
import bcrypt from "bcryptjs";
import {
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
import { DEFAULT_GOOGLE_REVIEWS, googleReviewsReady } from "@/lib/google-reviews";
import { staleCutoffDate } from "@/lib/stock-quality";

export { daysInStock, STALE_DAYS } from "@/lib/stock-quality";

/** Badge do menu: 15s de cache para não consultar o banco em toda navegação. */
export const getNewLeadsBadgeCount = unstable_cache(
  async () => {
    try {
      return await prisma.leadVenda.count({ where: { status: "novo" } });
    } catch {
      return 0;
    }
  },
  ["admin-new-leads-badge"],
  { revalidate: 15, tags: [ADMIN_NEW_LEADS_TAG] },
);

/** bcrypt em todo admin a cada dashboard é caro — cacheia o alerta. */
export const getUsingSeedPassword = unstable_cache(
  async () => {
    try {
      const admins = await prisma.admin.findMany({
        select: { passwordHash: true },
      });
      const matches = await Promise.all(
        admins.flatMap((admin) =>
          WEAK_ADMIN_PASSWORDS.map((password) =>
            bcrypt.compare(password, admin.passwordHash),
          ),
        ),
      );
      return matches.some(Boolean);
    } catch {
      return false;
    }
  },
  ["admin-seed-password"],
  { revalidate: 300, tags: [ADMIN_SEED_PASSWORD_TAG] },
);

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData() {
  const monthStart = startOfMonth();
  const staleBefore = staleCutoffDate();

  // Consultas isoladas: se uma tabela ainda não existir, o dashboard não cai inteiro.
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T) => {
    try {
      return await fn();
    } catch (error) {
      console.error(`[dashboard] ${label}:`, error);
      return fallback;
    }
  };

  const [
    vehicleGroups,
    featured,
    availableAggregate,
    salesAggregate,
    monthSales,
    leadGroups,
    recentLeads,
    recentVehicles,
    staleVehicles,
    withoutPhotos,
    withoutVideo,
    customers,
    publishedTestimonials,
    usingSeedPassword,
    publicSite,
    googleReviews,
  ] = await Promise.all([
    safe("vehicle.groupBy", () => prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }), []),
    safe("featured", () => prisma.vehicle.count({ where: { status: "disponivel", featured: true } }), 0),
    safe(
      "availableAggregate",
      () =>
        prisma.vehicle.aggregate({
          where: { status: "disponivel" },
          _sum: { price: true },
          _avg: { price: true, km: true },
        }),
      { _sum: { price: null }, _avg: { price: null, km: null } },
    ),
    safe(
      "salesAggregate",
      () => prisma.sale.aggregate({ _sum: { salePrice: true }, _count: { _all: true } }),
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
    safe("lead.groupBy", () => prisma.leadVenda.groupBy({ by: ["status"], _count: { _all: true } }), []),
    safe("recentLeads", () => prisma.leadVenda.findMany({ orderBy: { createdAt: "desc" }, take: 5 }), []),
    safe(
      "recentVehicles",
      () =>
        prisma.vehicle.findMany({
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
              select: { url: true },
            },
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
      "withoutVideo",
      () =>
        prisma.vehicle.findMany({
          where: {
            status: { not: "vendido" },
            historical: false,
            hasVideo: false,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, brand: true, model: true },
        }),
      [],
    ),
    safe("customers", () => prisma.customer.count(), 0),
    safe("testimonials", () => prisma.testimonial.count({ where: { published: true } }), 0),
    getUsingSeedPassword(),
    safe("publicSite", () => getPublicSite(), null as Awaited<ReturnType<typeof getPublicSite>> | null),
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
  const siteDefaults = (await import("@/lib/site")).site;
  const siteForPlaceholders = publicSite ?? {
    ...siteDefaults,
    ...DEFAULT_ABOUT,
  };

  return {
    vehicles: {
      total: vehicleGroups.reduce((sum, group) => sum + group._count._all, 0),
      available,
      reserved: byStatus("reservado"),
      sold: byStatus("vendido"),
      featured,
      stockValue: availableAggregate._sum.price ?? 0,
      averagePrice: availableAggregate._avg.price ?? 0,
      averageKm: availableAggregate._avg.km ?? 0,
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
    customers,
    publishedTestimonials,
    recentVehicles,
    alerts: {
      staleVehicles,
      withoutPhotos,
      withoutVideo,
      noFeatured: available > 0 && featured === 0,
      noTestimonials: publishedTestimonials === 0,
      noGoogleReviews: !googleReviewsReady(googleReviews),
      usingSeedPassword,
      placeholders: listPlaceholderLabels(siteForPlaceholders),
    },
  };
}
