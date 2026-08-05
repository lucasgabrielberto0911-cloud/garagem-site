import bcrypt from "bcryptjs";
import { WEAK_ADMIN_PASSWORDS } from "@/lib/admin-security";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import { site } from "@/lib/site";

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
  ] = await Promise.all([
    prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.vehicle.count({ where: { status: "disponivel", featured: true } }),
    prisma.vehicle.aggregate({
      where: { status: "disponivel" },
      _sum: { price: true },
      _avg: { price: true, km: true },
    }),
    prisma.sale.aggregate({ _sum: { salePrice: true }, _count: { _all: true } }),
    prisma.sale.aggregate({
      where: { saleDate: { gte: monthStart } },
      _sum: { salePrice: true },
      _count: { _all: true },
    }),
    prisma.leadVenda.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.leadVenda.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.vehicle.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { photos: { orderBy: { order: "asc" }, take: 1 } },
    }),
    prisma.vehicle.findMany({
      where: { status: "disponivel", createdAt: { lt: staleBefore } },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, brand: true, model: true, createdAt: true },
    }),
    prisma.vehicle.findMany({
      where: { status: { not: "vendido" }, photos: { none: {} } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, brand: true, model: true },
    }),
    prisma.customer.count(),
    prisma.testimonial.count({ where: { published: true } }),
    prisma.admin.findMany({ select: { passwordHash: true } }),
  ]);

  /**
   * Enquanto algum acesso continuar com senha fraca/padrão, o painel avisa: é o
   * risco de segurança mais provável numa instalação nova.
   */
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
      placeholders: PLACEHOLDER_FIELDS.filter(({ value }) =>
        value.includes("["),
      ).map(({ label }) => label),
    },
  };
}

/**
 * Campos de `src/lib/site.ts` que ainda estão como placeholder aparecem no
 * dashboard para lembrar de preencher antes de divulgar o site.
 */
const PLACEHOLDER_FIELDS = [
  { label: "Endereço", value: site.address },
  { label: "Cidade/região", value: site.region },
  { label: "E-mail", value: site.email },
  { label: "Horário", value: site.hours },
] as const;
