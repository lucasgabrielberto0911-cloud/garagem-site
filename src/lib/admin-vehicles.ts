import { prisma } from "@/lib/prisma";
import { staleCutoffDate } from "@/lib/stock-quality";
import { hasCostBasis, investedTotal } from "@/lib/vehicle-ops";

export const ADMIN_VEHICLES_PAGE_SIZE = 20;
export const ADMIN_SALES_PAGE_SIZE = 30;
export const ADMIN_CUSTOMERS_PAGE_SIZE = 40;
export const ADMIN_LEADS_PAGE_SIZE = 40;

export type SalesPeriod = "all" | "month" | "30" | "90" | "year";

export function parseSalesPeriod(value?: string | null): SalesPeriod {
  if (value === "month" || value === "30" || value === "90" || value === "year") {
    return value;
  }
  return "all";
}

export function salesPeriodWhere(period: SalesPeriod) {
  if (period === "all") return {};
  const now = new Date();
  if (period === "month") {
    return { saleDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
  }
  if (period === "year") {
    return { saleDate: { gte: new Date(now.getFullYear(), 0, 1) } };
  }
  const days = Number(period);
  return {
    saleDate: { gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) },
  };
}

export type VehiclesTab = "estoque" | "vendidos";
export type AdminVehiclesSort = "recent" | "year" | "km" | "price";

export const ADMIN_VEHICLE_LIST_SELECT = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  year: true,
  yearModel: true,
  km: true,
  price: true,
  status: true,
  featured: true,
  inStoreName: true,
  hasSpareKey: true,
  hasManual: true,
  purchasePrice: true,
  createdAt: true,
  hasVideo: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true },
  },
  costs: { select: { amount: true } },
  sale: { select: { salePrice: true } },
} as const;

export type AdminVehicleListItem = {
  id: string;
  category: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  yearModel: number;
  km: number;
  price: number;
  status: string;
  featured: boolean;
  inStoreName: boolean;
  hasSpareKey: boolean;
  hasManual: boolean;
  purchasePrice: number | null;
  createdAt: Date;
  hasVideo: boolean;
  photos: Array<{ url: string }>;
  costs: Array<{ amount: number }>;
  sale: { salePrice: number } | null;
};

export const ADMIN_SALE_LIST_INCLUDE = {
  vehicle: {
    select: {
      id: true,
      brand: true,
      model: true,
      yearModel: true,
      plate: true,
      historical: true,
      purchasePrice: true,
      costs: { select: { amount: true } },
    },
  },
  customer: { select: { id: true, name: true, phone: true } },
} as const;

function tabStatusFilter(tab: VehiclesTab) {
  return tab === "vendidos"
    ? { status: "vendido" }
    : { status: { in: ["disponivel", "reservado"] } };
}

function searchWhere(q: string) {
  const term = q.trim();
  if (!term) return {};
  return {
    OR: [
      { brand: { contains: term, mode: "insensitive" as const } },
      { model: { contains: term, mode: "insensitive" as const } },
      { version: { contains: term, mode: "insensitive" as const } },
      { color: { contains: term, mode: "insensitive" as const } },
      { plate: { contains: term, mode: "insensitive" as const } },
    ],
  };
}

function listOrderBy(sort: AdminVehiclesSort, dir: "asc" | "desc") {
  if (sort === "year") return { yearModel: dir };
  if (sort === "km") return { km: dir };
  if (sort === "price") return { price: dir };
  return { createdAt: dir };
}

export function parseAdminVehiclesSort(value?: string | null): AdminVehiclesSort {
  if (value === "year" || value === "km" || value === "price" || value === "recent") {
    return value;
  }
  return "recent";
}

export function parseAdminVehiclesDir(
  value?: string | null,
  sort: AdminVehiclesSort = "recent",
): "asc" | "desc" {
  if (value === "asc" || value === "desc") return value;
  return sort === "recent" ? "desc" : "asc";
}

export async function getAdminVehiclesPage(options: {
  q?: string;
  tab: VehiclesTab;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: AdminVehiclesSort;
  dir?: "asc" | "desc";
}) {
  const pageSize = Math.min(
    Math.max(options.pageSize ?? ADMIN_VEHICLES_PAGE_SIZE, 1),
    50,
  );
  const page = Math.max(options.page ?? 1, 1);
  const sort = options.sort ?? "recent";
  const dir = options.dir ?? (sort === "recent" ? "desc" : "asc");
  const statusFilter =
    options.status === "disponivel" || options.status === "reservado"
      ? { status: options.status }
      : tabStatusFilter(options.tab);
  const where = {
    AND: [
      { historical: false },
      statusFilter,
      searchWhere(options.q ?? ""),
    ],
  };

  const [total, vehicles] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      select: ADMIN_VEHICLE_LIST_SELECT,
      orderBy: listOrderBy(sort, dir),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    vehicles: vehicles as AdminVehicleListItem[],
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export async function getAdminVehicleStats() {
  const stockWhere = {
    historical: false,
    status: { in: ["disponivel", "reservado"] },
  };

  const [groups, stockValue, availableRows, withoutPhotos, withoutVideo, stale] =
    await Promise.all([
    prisma.vehicle.groupBy({
      by: ["status"],
      where: { historical: false },
      _count: { _all: true },
    }),
    prisma.vehicle.aggregate({
      where: { status: "disponivel", historical: false },
      _sum: { price: true },
    }),
    prisma.vehicle.findMany({
      where: { status: "disponivel", historical: false },
      select: { purchasePrice: true, costs: { select: { amount: true } } },
    }),
    prisma.vehicle.count({
      where: { ...stockWhere, photos: { none: {} } },
    }),
    prisma.vehicle.count({
      where: { ...stockWhere, hasVideo: false },
    }),
    prisma.vehicle.count({
      where: {
        historical: false,
        status: "disponivel",
        createdAt: { lt: staleCutoffDate() },
      },
    }),
  ]);

  const count = (value: string) =>
    groups.find((group) => group.status === value)?._count._all ?? 0;

  const invested = availableRows.reduce(
    (sum, item) => sum + investedTotal(item.purchasePrice, item.costs),
    0,
  );
  const withCostBasis = availableRows.filter((item) =>
    hasCostBasis(item.purchasePrice, item.costs),
  ).length;

  return {
    available: count("disponivel"),
    reserved: count("reservado"),
    sold: count("vendido"),
    estoqueCount: count("disponivel") + count("reservado"),
    vendidosCount: count("vendido"),
    stockValue: stockValue._sum.price ?? 0,
    invested,
    withCostBasis,
    withoutPhotos,
    withoutVideo,
    stale,
  };
}

export async function getAdminSalesPage(options?: {
  page?: number;
  pageSize?: number;
  period?: SalesPeriod;
}) {
  const pageSize = Math.min(
    Math.max(options?.pageSize ?? ADMIN_SALES_PAGE_SIZE, 1),
    80,
  );
  const page = Math.max(options?.page ?? 1, 1);
  const period = options?.period ?? "all";
  const where = salesPeriodWhere(period);

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      include: ADMIN_SALE_LIST_INCLUDE,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    sales,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
