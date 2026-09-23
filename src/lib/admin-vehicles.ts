import { unstable_cache } from "next/cache";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { staleCutoffDate } from "@/lib/stock-quality";
import { hasCostBasis, investedTotal } from "@/lib/vehicle-ops";
import { DEFAULT_VEHICLE_LOCATION_CITY } from "@/lib/vehicle-location";

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

export type VehiclesTab = "estoque" | "vendidos" | "destaques";
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
  locationCity: true,
  featured: true,
  inStoreName: true,
  hasSpareKey: true,
  hasManual: true,
  purchasePrice: true,
  createdAt: true,
  updatedAt: true,
  hasVideo: true,
  transmission: true,
  color: true,
  plate: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
  costs: { select: { amount: true } },
  sale: { select: { salePrice: true } },
  _count: { select: { photos: true } },
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
  locationCity: string;
  featured: boolean;
  inStoreName: boolean;
  hasSpareKey: boolean;
  hasManual: boolean;
  purchasePrice: number | null;
  createdAt: Date;
  updatedAt?: Date | string | null;
  hasVideo: boolean;
  transmission: string;
  color: string | null;
  plate: string | null;
  photos: Array<{ url: string; thumbnailUrl?: string | null }>;
  photoCount: number;
  costs: Array<{ amount: number }>;
  sale: { salePrice: number } | null;
};

function toAdminVehicleListItem(
  row: Omit<AdminVehicleListItem, "photoCount"> & {
    _count?: { photos: number };
  },
): AdminVehicleListItem {
  const { _count, ...rest } = row;
  return {
    ...rest,
    locationCity: rest.locationCity || DEFAULT_VEHICLE_LOCATION_CITY,
    photoCount: _count?.photos ?? rest.photos.length,
  };
}

const ADMIN_VEHICLE_LIST_SELECT_NO_CITY = {
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
  updatedAt: true,
  hasVideo: true,
  transmission: true,
  color: true,
  plate: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
  costs: { select: { amount: true } },
  sale: { select: { salePrice: true } },
  _count: { select: { photos: true } },
} as const;

async function listAdminVehicles(args: {
  where: NonNullable<Parameters<typeof prisma.vehicle.findMany>[0]>["where"];
  orderBy: NonNullable<Parameters<typeof prisma.vehicle.findMany>[0]>["orderBy"];
  skip: number;
  take: number;
}) {
  try {
    return await prisma.vehicle.findMany({
      ...args,
      select: ADMIN_VEHICLE_LIST_SELECT,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "locationCity")) throw error;
    const rows = await prisma.vehicle.findMany({
      ...args,
      select: ADMIN_VEHICLE_LIST_SELECT_NO_CITY,
    });
    return rows.map((row) => ({
      ...row,
      locationCity: DEFAULT_VEHICLE_LOCATION_CITY,
    }));
  }
}

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
  if (tab === "vendidos") return { status: "vendido" };
  if (tab === "destaques") {
    return { featured: true, status: { in: ["disponivel", "reservado"] } };
  }
  return { status: { in: ["disponivel", "reservado"] } };
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

  const [total, vehicleRows] = await Promise.all([
    prisma.vehicle.count({ where }),
    listAdminVehicles({
      where,
      orderBy: listOrderBy(sort, dir),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    vehicles: vehicleRows.map(toAdminVehicleListItem),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

async function loadAdminVehicleStats() {
  const stockWhere = {
    historical: false,
    status: { in: ["disponivel", "reservado"] },
  };

  const [groups, stockValue, availableRows, withoutPhotos, withoutVideo, stale, featured] =
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
    prisma.vehicle.count({
      where: { historical: false, status: "disponivel", featured: true },
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
    featured,
  };
}

/** Contadores do topo da lista: só números, expiram com expireAdminData(). */
export const getAdminVehicleStats = unstable_cache(
  loadAdminVehicleStats,
  ["admin-vehicle-stats-v1"],
  { revalidate: 60, tags: [ADMIN_DATA_TAG] },
);

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

export const SELLABLE_VEHICLE_SELECT = {
  id: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  price: true,
  status: true,
  purchasePrice: true,
  costs: { select: { amount: true } },
} as const;

export type SellableVehicleRecord = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  price: number;
  status: string;
  purchasePrice: number | null;
  costs: Array<{ amount: number }>;
};

/** Veículos sem venda para o formulário de vendas — busca sob demanda. */
export async function getSellableVehicles(options?: {
  q?: string;
  take?: number;
}) {
  const take = Math.min(Math.max(options?.take ?? 20, 1), 50);
  const vehicles = await prisma.vehicle.findMany({
    where: {
      AND: [{ sale: null, historical: false }, searchWhere(options?.q ?? "")],
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
    select: SELLABLE_VEHICLE_SELECT,
  });
  return vehicles as SellableVehicleRecord[];
}

export type CustomerSearchRecord = {
  id: string;
  name: string;
  phone: string;
};

export async function searchCustomers(options?: { q?: string; take?: number }) {
  const take = Math.min(Math.max(options?.take ?? 20, 1), 50);
  const term = (options?.q ?? "").trim();
  const digits = term.replace(/\D/g, "");
  const where = term
    ? {
        OR: [
          { name: { contains: term, mode: "insensitive" as const } },
          { phone: { contains: digits || term, mode: "insensitive" as const } },
          { email: { contains: term, mode: "insensitive" as const } },
          { cpf: { contains: digits || term, mode: "insensitive" as const } },
        ],
      }
    : {};

  return prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    select: { id: true, name: true, phone: true },
  }) as Promise<CustomerSearchRecord[]>;
}
