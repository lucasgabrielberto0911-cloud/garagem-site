import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { brandKey, formatBrandName } from "@/lib/format";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";

/** Tag do cache público — invalidada quando o estoque muda no admin. */
export const VEHICLES_PUBLIC_CACHE_TAG = "vehicles-public";

/**
 * Campos mínimos do card de listagem (estoque / home / relacionados).
 * Evita puxar description, accessories, fipePrice, etc.
 */
export const PUBLIC_VEHICLE_CARD_SELECT = {
  id: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  km: true,
  price: true,
  transmission: true,
  fuel: true,
  status: true,
  featured: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { id: true, url: true, order: true, vehicleId: true },
  },
  _count: { select: { photos: true } },
} as const;

/** @deprecated Prefira PUBLIC_VEHICLE_CARD_SELECT (select enxuto). */
export const PUBLIC_VEHICLE_CARD_INCLUDE = {
  photos: { orderBy: { order: "asc" as const }, take: 1 },
  _count: { select: { photos: true } },
} as const;

/** Detalhe e edição carregam todas as fotos. */
export const PUBLIC_VEHICLE_INCLUDE = {
  photos: { orderBy: { order: "asc" as const } },
} as const;

/** Nunca enviar preço FIPE nem placa completa ao site / APIs públicas. */
export const PUBLIC_VEHICLE_OMIT = {
  fipePrice: true,
  plate: true,
} as const;

export const STOCK_PAGE_SIZE = 12;

export type VehicleCardRecord = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  km: number;
  price: number;
  transmission: string;
  fuel: string;
  status: string;
  featured: boolean;
  photos: Array<{ id: string; url: string; order: number; vehicleId: string }>;
  _count?: { photos: number };
};

export type SiteQueryMeta = {
  /** Preenchido quando a consulta falhou e o fallback foi usado. */
  error?: string;
};

/**
 * O site público evita quebrar por falha de banco, mas registra e sinaliza
 * o erro para a UI mostrar aviso (em vez de "estoque vazio" silencioso).
 */
async function safeQuery<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T & SiteQueryMeta> {
  try {
    const data = await run();
    return data as T & SiteQueryMeta;
  } catch (error) {
    console.error(`[site] falha ao consultar ${label}:`, error);
    const message =
      error instanceof Error ? error.message : `Falha ao consultar ${label}`;
    if (dataIsObject(fallback)) {
      return { ...fallback, error: message } as T & SiteQueryMeta;
    }
    return fallback as T & SiteQueryMeta;
  }
}

function dataIsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getFeaturedVehicles(take = 8) {
  return safeQuery(
    "veículos em destaque",
    async () => {
      const featured = await prisma.vehicle.findMany({
        where: { status: "disponivel", featured: true },
        select: PUBLIC_VEHICLE_CARD_SELECT,
        orderBy: { createdAt: "desc" },
        take,
      });

      if (featured.length > 0) return featured;

      return prisma.vehicle.findMany({
        where: { status: "disponivel" },
        select: PUBLIC_VEHICLE_CARD_SELECT,
        orderBy: { createdAt: "desc" },
        take: 4,
      });
    },
    [] as VehicleCardRecord[],
  );
}

/** Para interesse/troca: não resolve veículos já vendidos. */
export function getVehicleById(id: string) {
  return safeQuery(
    `veículo ${id}`,
    () =>
      prisma.vehicle.findFirst({
        where: { id, status: { not: "vendido" } },
        omit: PUBLIC_VEHICLE_OMIT,
        include: PUBLIC_VEHICLE_INCLUDE,
      }),
    null,
  );
}

/**
 * Resolve por cuid ou slug SEO (`marca-modelo-ano-{cuid}`).
 * Inclui vendidos para a página de detalhe não retornar 404 após a venda.
 * (Fluxos de interesse/vender devem usar getVehicleById.)
 */
export function getVehicleByParam(param: string) {
  const id = extractVehicleIdFromParam(param);
  if (!id) return Promise.resolve(null);

  return safeQuery(
    `veículo ${id}`,
    () =>
      prisma.vehicle.findUnique({
        where: { id },
        omit: PUBLIC_VEHICLE_OMIT,
        include: PUBLIC_VEHICLE_INCLUDE,
      }),
    null,
  );
}

/**
 * Relacionados: mesma marca → mesma categoria + faixa de preço → categoria → estoque.
 */
export function getRelatedVehicles(
  vehicleId: string,
  brand: string,
  take = 4,
  category?: string,
  price?: number,
) {
  return safeQuery(
    "veículos relacionados",
    async () => {
      const select = PUBLIC_VEHICLE_CARD_SELECT;
      const base = {
        status: "disponivel" as const,
        id: { not: vehicleId },
      };

      const byBrand = await prisma.vehicle.findMany({
        where: {
          ...base,
          brand,
          ...(category ? { category } : {}),
        },
        select,
        orderBy: { createdAt: "desc" },
        take,
      });
      if (byBrand.length >= take) return byBrand;

      const seen = new Set(byBrand.map((item) => item.id));
      const remaining = take - byBrand.length;

      if (category && price && price > 0) {
        const margin = price * 0.25;
        const byPrice = await prisma.vehicle.findMany({
          where: {
            ...base,
            category,
            price: { gte: price - margin, lte: price + margin },
            id: { notIn: [vehicleId, ...Array.from(seen)] },
          },
          select,
          orderBy: { createdAt: "desc" },
          take: remaining,
        });
        for (const item of byPrice) seen.add(item.id);
        const merged = [...byBrand, ...byPrice];
        if (merged.length >= take) return merged;

        const still = take - merged.length;
        const byCategory = await prisma.vehicle.findMany({
          where: {
            ...base,
            category,
            id: { notIn: [vehicleId, ...Array.from(seen)] },
          },
          select,
          orderBy: { createdAt: "desc" },
          take: still,
        });
        const withCategory = [...merged, ...byCategory];
        if (withCategory.length >= take) return withCategory;

        const fill = take - withCategory.length;
        const extras = await prisma.vehicle.findMany({
          where: {
            ...base,
            id: { notIn: [vehicleId, ...withCategory.map((item) => item.id)] },
          },
          select,
          orderBy: { createdAt: "desc" },
          take: fill,
        });
        return [...withCategory, ...extras];
      }

      if (category) {
        const byCategory = await prisma.vehicle.findMany({
          where: {
            ...base,
            category,
            id: { notIn: [vehicleId, ...Array.from(seen)] },
          },
          select,
          orderBy: { createdAt: "desc" },
          take: remaining,
        });
        const merged = [...byBrand, ...byCategory];
        if (merged.length >= take) return merged;

        const extras = await prisma.vehicle.findMany({
          where: {
            ...base,
            id: { notIn: [vehicleId, ...merged.map((item) => item.id)] },
          },
          select,
          orderBy: { createdAt: "desc" },
          take: take - merged.length,
        });
        return [...merged, ...extras];
      }

      if (byBrand.length > 0) return byBrand;

      return prisma.vehicle.findMany({
        where: base,
        select,
        orderBy: { createdAt: "desc" },
        take,
      });
    },
    [] as VehicleCardRecord[],
  );
}

export type StockFilters = {
  q?: string;
  category?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxKm?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type StockPageResult = {
  vehicles: VehicleCardRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
};

const SORT_MAP: Record<string, { [key: string]: "asc" | "desc" }> = {
  recentes: { createdAt: "desc" },
  "menor-preco": { price: "asc" },
  "maior-preco": { price: "desc" },
  "menor-km": { km: "asc" },
  "mais-novo": { yearModel: "desc" },
};

function buildStockWhere(filters: StockFilters) {
  const terms = (filters.q ?? "").trim().split(/\s+/).filter(Boolean);
  const priceFilter =
    filters.minPrice || filters.maxPrice
      ? {
          price: {
            ...(filters.minPrice ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
          },
        }
      : {};
  const yearFilter =
    filters.minYear || filters.maxYear
      ? {
          yearModel: {
            ...(filters.minYear ? { gte: filters.minYear } : {}),
            ...(filters.maxYear ? { lte: filters.maxYear } : {}),
          },
        }
      : {};

  return {
    status: "disponivel" as const,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.brand
      ? { brand: { equals: filters.brand, mode: "insensitive" as const } }
      : {}),
    ...(filters.transmission ? { transmission: filters.transmission } : {}),
    ...(filters.fuel ? { fuel: filters.fuel } : {}),
    ...priceFilter,
    ...yearFilter,
    ...(filters.maxKm ? { km: { lte: filters.maxKm } } : {}),
    ...(terms.length
      ? {
          AND: terms.map((term) => ({
            OR: [
              { brand: { contains: term, mode: "insensitive" as const } },
              { model: { contains: term, mode: "insensitive" as const } },
              { version: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        }
      : {}),
  };
}

async function fetchStockPage(filters: StockFilters) {
  const pageSize = Math.min(
    Math.max(filters.pageSize ?? STOCK_PAGE_SIZE, 1),
    48,
  );
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildStockWhere(filters);
  const orderBy = SORT_MAP[filters.sort ?? "recentes"] ?? SORT_MAP.recentes;

  const [total, vehicles] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      select: PUBLIC_VEHICLE_CARD_SELECT,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    vehicles,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** @deprecated Use getStockPage — mantido para callers simples. */
export function getStockVehicles(filters: StockFilters) {
  return safeQuery(
    "estoque",
    async () => {
      const result = await fetchStockPage({
        ...filters,
        page: 1,
        pageSize: 500,
      });
      return result.vehicles;
    },
    [] as VehicleCardRecord[],
  );
}

export function getStockPage(filters: StockFilters): Promise<StockPageResult> {
  return safeQuery(
    "estoque",
    () => fetchStockPage(filters),
    {
      vehicles: [] as VehicleCardRecord[],
      total: 0,
      page: 1,
      pageSize: filters.pageSize ?? STOCK_PAGE_SIZE,
      totalPages: 1,
    },
  );
}

type StockFacets = {
  categories: string[];
  brands: string[];
  transmissions: string[];
  fuels: string[];
  years: number[];
};

const EMPTY_FACETS: StockFacets = {
  categories: [],
  brands: [],
  transmissions: [],
  fuels: [],
  years: [],
};

/**
 * Facets via groupBy (não carrega todos os veículos).
 * Cache cross-request — invalidado com VEHICLES_PUBLIC_CACHE_TAG.
 */
const loadStockFacetsCached = unstable_cache(
  async (): Promise<StockFacets> => {
    const available = { status: "disponivel" as const };

    const [categories, brands, transmissions, fuels, years] = await Promise.all([
      prisma.vehicle.groupBy({
        by: ["category"],
        where: available,
        orderBy: { category: "asc" },
      }),
      prisma.vehicle.groupBy({
        by: ["brand"],
        where: available,
        orderBy: { brand: "asc" },
      }),
      prisma.vehicle.groupBy({
        by: ["transmission"],
        where: available,
        orderBy: { transmission: "asc" },
      }),
      prisma.vehicle.groupBy({
        by: ["fuel"],
        where: available,
        orderBy: { fuel: "asc" },
      }),
      prisma.vehicle.groupBy({
        by: ["yearModel"],
        where: available,
        orderBy: { yearModel: "desc" },
      }),
    ]);

    const brandsByKey = new Map<string, string>();
    for (const row of brands) {
      const raw = row.brand?.trim();
      if (!raw) continue;
      const key = brandKey(raw);
      if (!brandsByKey.has(key)) {
        brandsByKey.set(key, formatBrandName(raw));
      }
    }

    const unique = (values: string[]) =>
      Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      );

    return {
      categories: unique(categories.map((row) => row.category)),
      brands: Array.from(brandsByKey.values()).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
      transmissions: unique(transmissions.map((row) => row.transmission)),
      fuels: unique(fuels.map((row) => row.fuel)),
      years: years.map((row) => row.yearModel),
    };
  },
  ["stock-facets-v2"],
  { revalidate: 60, tags: [VEHICLES_PUBLIC_CACHE_TAG] },
);

export function getStockFacets() {
  return safeQuery("filtros do estoque", () => loadStockFacetsCached(), EMPTY_FACETS);
}

export function getSiteStats() {
  return safeQuery(
    "estatísticas",
    async () => {
      const [available, sales] = await Promise.all([
        prisma.vehicle.count({ where: { status: "disponivel" } }),
        prisma.sale.count(),
      ]);
      return { available, sales };
    },
    { available: 0, sales: 0 },
  );
}

export function getTestimonials(take = 6) {
  return safeQuery(
    "depoimentos",
    () =>
      prisma.testimonial.findMany({
        where: { published: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take,
      }),
    [],
  );
}
