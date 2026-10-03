import { customerSearchWhere } from "@/lib/admin-customer-search";
import { businessPeriodStart } from "@/lib/admin-date";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { staleCutoffDate } from "@/lib/stock-quality";
import { investedTotal } from "@/lib/vehicle-ops";
import { DEFAULT_VEHICLE_LOCATION_CITY } from "@/lib/vehicle-location";

export const ADMIN_VEHICLES_PAGE_SIZE = 20;
/** Primeira dobra leve no celular; o resto vem por paginação / rolagem. */
export const ADMIN_SALES_PAGE_SIZE = 20;
export const ADMIN_CUSTOMERS_PAGE_SIZE = 20;
export const ADMIN_LEADS_PAGE_SIZE = 20;

export type SalesPeriod = "all" | "month" | "30" | "90" | "year";

export function parseSalesPeriod(value?: string | null): SalesPeriod {
  if (
    value === "month" ||
    value === "30" ||
    value === "90" ||
    value === "year"
  ) {
    return value;
  }
  return "all";
}

export function salesPeriodWhere(period: SalesPeriod) {
  if (period === "all") return {};
  const now = new Date();
  if (period === "month") {
    return { saleDate: { gte: businessPeriodStart("month", now) } };
  }
  if (period === "year") {
    return { saleDate: { gte: businessPeriodStart("year", now) } };
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
  consigned: true,
  createdAt: true,
  updatedAt: true,
  transmission: true,
  color: true,
  plate: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
  sale: { select: { salePrice: true } },
  costs: { select: { amount: true } },
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
  consigned: boolean;
  createdAt: Date;
  updatedAt?: Date | string | null;
  transmission: string;
  color: string | null;
  plate: string | null;
  photos: Array<{ url: string; thumbnailUrl?: string | null }>;
  photoCount: number;
  /** Soma dos custos extras (a lista não carrega as linhas de custo). */
  costsTotal: number;
  sale: { salePrice: number } | null;
};

function toAdminVehicleListItem(
  row: Omit<AdminVehicleListItem, "photoCount" | "costsTotal"> & {
    _count?: { photos: number };
    costs?: Array<{ amount: number }>;
  },
): AdminVehicleListItem {
  const { _count, costs, ...rest } = row;
  return {
    ...rest,
    locationCity: rest.locationCity || DEFAULT_VEHICLE_LOCATION_CITY,
    photoCount: _count?.photos ?? rest.photos.length,
    // Consignado não soma custo da loja — igual à consulta antiga, que pulava esses ids.
    costsTotal: rest.consigned
      ? 0
      : (costs ?? []).reduce((sum, cost) => sum + (cost.amount || 0), 0),
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
  consigned: true,
  createdAt: true,
  updatedAt: true,
  transmission: true,
  color: true,
  plate: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
  sale: { select: { salePrice: true } },
  costs: { select: { amount: true } },
  _count: { select: { photos: true } },
} as const;

async function listAdminVehicles(args: {
  where: NonNullable<Parameters<typeof prisma.vehicle.findMany>[0]>["where"];
  orderBy: NonNullable<
    Parameters<typeof prisma.vehicle.findMany>[0]
  >["orderBy"];
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
      consigned: true,
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

export function parseAdminVehiclesSort(
  value?: string | null,
): AdminVehiclesSort {
  if (
    value === "year" ||
    value === "km" ||
    value === "price" ||
    value === "recent"
  ) {
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
    AND: [{ historical: false }, statusFilter, searchWhere(options.q ?? "")],
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
    vehicles: vehicleRows.map((row) => toAdminVehicleListItem(row)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/** Estoque próprio: consignado fica na vitrine, mas fora do valor e do investido. */
export const OWNED_AVAILABLE_WHERE = {
  status: "disponivel",
  historical: false,
  consigned: false,
} as const;

export type AdminVehicleStats = {
  available: number;
  reserved: number;
  sold: number;
  estoqueCount: number;
  vendidosCount: number;
  stockValue: number;
  ownedAvailable: number;
  consignedAvailable: number;
  invested: number;
  withCostBasis: number;
  withoutPhotos: number;
  stale: number;
  featured: number;
};

export type AdminVehicleStatsRow = {
  available?: unknown;
  reserved?: unknown;
  sold?: unknown;
  featured?: unknown;
  stale?: unknown;
  withoutPhotos?: unknown;
  stockValue?: unknown;
  purchaseSum?: unknown;
  ownedAvailable?: unknown;
  withCostBasis?: unknown;
  extraCosts?: unknown;
};

function statNum(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Uma linha do SQL único dos contadores → o mesmo formato da tela. */
export function mapAdminVehicleStatsRow(
  row?: AdminVehicleStatsRow | null,
): AdminVehicleStats {
  const available = statNum(row?.available);
  const reserved = statNum(row?.reserved);
  const ownedAvailable = statNum(row?.ownedAvailable);
  return {
    available,
    reserved,
    sold: statNum(row?.sold),
    estoqueCount: available + reserved,
    vendidosCount: statNum(row?.sold),
    stockValue: statNum(row?.stockValue),
    ownedAvailable,
    consignedAvailable: Math.max(available - ownedAvailable, 0),
    invested: investedTotal(
      statNum(row?.purchaseSum),
      statNum(row?.extraCosts),
    ),
    withCostBasis: statNum(row?.withCostBasis),
    withoutPhotos: statNum(row?.withoutPhotos),
    stale: statNum(row?.stale),
    featured: statNum(row?.featured),
  };
}

function isStatsSchemaDrift(error: unknown) {
  if (isMissingColumnError(error)) return true;
  const message = error instanceof Error ? error.message : "";
  return /42703|column .+ does not exist/i.test(message);
}

/**
 * Uma ida ao banco no lugar de várias contagens.
 * Vídeo não entra: a lista não mostra mais esse aviso.
 * Consignado continua fora do valor e do investido.
 */
async function loadAdminVehicleStatsSql(): Promise<AdminVehicleStats> {
  const staleBefore = staleCutoffDate();
  const rows = await prisma.$queryRaw<AdminVehicleStatsRow[]>`
    SELECT
      count(*) FILTER (WHERE v.status = 'disponivel')::int AS "available",
      count(*) FILTER (WHERE v.status = 'reservado')::int AS "reserved",
      count(*) FILTER (WHERE v.status = 'vendido')::int AS "sold",
      count(*) FILTER (WHERE v.status = 'disponivel' AND v.featured)::int AS "featured",
      count(*) FILTER (
        WHERE v.status = 'disponivel' AND v."createdAt" < ${staleBefore}
      )::int AS "stale",
      count(*) FILTER (
        WHERE v.status IN ('disponivel', 'reservado')
          AND NOT EXISTS (
            SELECT 1 FROM "Photo" p WHERE p."vehicleId" = v.id
          )
      )::int AS "withoutPhotos",
      coalesce(sum(v.price) FILTER (
        WHERE v.status = 'disponivel' AND v.consigned = false
      ), 0) AS "stockValue",
      coalesce(sum(v."purchasePrice") FILTER (
        WHERE v.status = 'disponivel' AND v.consigned = false
      ), 0) AS "purchaseSum",
      count(*) FILTER (
        WHERE v.status = 'disponivel' AND v.consigned = false
      )::int AS "ownedAvailable",
      count(*) FILTER (
        WHERE v.status = 'disponivel'
          AND v.consigned = false
          AND v."purchasePrice" > 0
      )::int AS "withCostBasis",
      (
        SELECT coalesce(sum(c.amount), 0)
        FROM "VehicleCost" c
        INNER JOIN "Vehicle" owned ON owned.id = c."vehicleId"
        WHERE owned.historical = false
          AND owned.status = 'disponivel'
          AND owned.consigned = false
      ) AS "extraCosts"
    FROM "Vehicle" v
    WHERE v.historical = false
  `;
  return mapAdminVehicleStatsRow(rows[0]);
}

/** Plano B se uma coluna nova ainda não existir no banco. */
async function loadAdminVehicleStatsQueries(): Promise<AdminVehicleStats> {
  const stockWhere = {
    historical: false,
    status: { in: ["disponivel", "reservado"] },
  };

  const [
    groups,
    stockValue,
    extraCosts,
    withCostBasis,
    withoutPhotos,
    stale,
    featured,
  ] = await Promise.all([
    prisma.vehicle.groupBy({
      by: ["status"],
      where: { historical: false },
      _count: { _all: true },
    }),
    prisma.vehicle.aggregate({
      where: OWNED_AVAILABLE_WHERE,
      _sum: { price: true, purchasePrice: true },
      _count: { _all: true },
    }),
    prisma.vehicleCost.aggregate({
      where: { vehicle: OWNED_AVAILABLE_WHERE },
      _sum: { amount: true },
    }),
    prisma.vehicle.count({
      where: {
        ...OWNED_AVAILABLE_WHERE,
        purchasePrice: { gt: 0 },
      },
    }),
    prisma.vehicle.count({
      where: { ...stockWhere, photos: { none: {} } },
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
  const available = count("disponivel");
  const ownedAvailable = stockValue._count._all;

  return {
    available,
    reserved: count("reservado"),
    sold: count("vendido"),
    estoqueCount: available + count("reservado"),
    vendidosCount: count("vendido"),
    stockValue: stockValue._sum.price ?? 0,
    ownedAvailable,
    consignedAvailable: Math.max(available - ownedAvailable, 0),
    invested: investedTotal(
      stockValue._sum.purchasePrice,
      extraCosts._sum.amount ?? 0,
    ),
    withCostBasis,
    withoutPhotos,
    stale,
    featured,
  };
}

async function loadAdminVehicleStats() {
  try {
    return await loadAdminVehicleStatsSql();
  } catch (error) {
    if (!isStatsSchemaDrift(error)) throw error;
    console.error(
      "[admin-vehicles] contadores em SQL único indisponíveis, usando consultas separadas:",
      error,
    );
    return loadAdminVehicleStatsQueries();
  }
}

/** Contadores do topo da lista: só números, expiram com expireAdminData(). */
export const getAdminVehicleStats = unstable_cache(
  loadAdminVehicleStats,
  ["admin-vehicle-stats-v3"],
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
  consigned: true,
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
  consigned: boolean;
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
  const where = customerSearchWhere(term);

  return prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    take,
    select: { id: true, name: true, phone: true },
  }) as Promise<CustomerSearchRecord[]>;
}

export async function getAdminSalesTotals(period: SalesPeriod) {
  const where = salesPeriodWhere(period);
  const start = "saleDate" in where ? where.saleDate?.gte : null;
  const filter = start
    ? Prisma.sql`WHERE s."saleDate" >= ${start}`
    : Prisma.empty;
  const [row] = await prisma.$queryRaw<
    Array<{
      count: number;
      revenue: number;
      profit: number;
      profitCount: number;
      incomplete: number;
      reviewCount: number;
    }>
  >(Prisma.sql`
    SELECT count(*)::int AS "count", coalesce(sum(round(s."salePrice"::numeric, 2)),0)::float8 AS "revenue",
      coalesce(sum(CASE WHEN v.consigned = false AND v."purchasePrice" > 0
        THEN round(s."salePrice"::numeric,2) - round(v."purchasePrice"::numeric,2) - coalesce(c.total,0) ELSE 0 END),0)::float8 AS "profit",
      count(*) FILTER (WHERE v.consigned = false AND v."purchasePrice" > 0)::int AS "profitCount",
      count(*) FILTER (WHERE v.consigned = false AND (v."purchasePrice" IS NULL OR v."purchasePrice" <= 0))::int AS "incomplete",
      count(*) FILTER (WHERE s."salePrice" < 1000)::int AS "reviewCount"
    FROM "Sale" s JOIN "Vehicle" v ON v.id = s."vehicleId"
    LEFT JOIN LATERAL (SELECT sum(round(amount::numeric,2)) AS total FROM "VehicleCost" WHERE "vehicleId" = v.id) c ON true
    ${filter}`);
  return row;
}
