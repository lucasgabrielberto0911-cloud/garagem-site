import bcrypt from "bcryptjs";
import { WEAK_ADMIN_PASSWORDS } from "@/lib/admin-security";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import { getPublicSite, listPlaceholderLabels } from "@/lib/site-settings";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Veículo disponível parado há mais tempo que isso entra nos alertas. */
export const STALE_DAYS = 60;

export function daysInStock(createdAt: Date) {
  return Math.floor((Date.now() - createdAt.getTime()) / DAY_MS);
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData() {
  const monthStart = startOfMonth();
  const staleBefore = new Date(Date.now() - STALE_DAYS * DAY_MS);

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
    customers,
    publishedTestimonials,
    admins,
    publicSite,
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
          include: { photos: { orderBy: { order: "asc" }, take: 1 } },
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
    safe("customers", () => prisma.customer.count(), 0),
    safe("testimonials", () => prisma.testimonial.count({ where: { published: true } }), 0),
    safe("admins", () => prisma.admin.findMany({ select: { passwordHash: true } }), []),
    safe("publicSite", () => getPublicSite(), null as Awaited<ReturnType<typeof getPublicSite>> | null),
  ]);

  const usingSeedPassword = (
    await Promise.all(
      admins.flatMap((admin) =>
        WEAK_ADMIN_PASSWORDS.map((password) =>
          bcrypt.compare(password, admin.passwordHash),
        ),
      ),
    )
  ).some(Boolean);

  const byStatus = (status: string) =>
    vehicleGroups.find((group) => group.status === status)?._count._all ?? 0;

  const leadsByStatus = Object.fromEntries(
    LEAD_STATUSES.map((status) => [
      status,
      leadGroups.find((group) => group.status === status)?._count._all ?? 0,
    ]),
  ) as Record<LeadStatus, number>;

  const available = byStatus("disponivel");
  const siteForPlaceholders = publicSite ?? (await import("@/lib/site")).site;

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
      noFeatured: available > 0 && featured === 0,
      noTestimonials: publishedTestimonials === 0,
      usingSeedPassword,
      placeholders: listPlaceholderLabels(siteForPlaceholders),
    },
  };
}
