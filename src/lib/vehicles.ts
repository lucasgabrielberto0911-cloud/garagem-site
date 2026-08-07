import { prisma } from "@/lib/prisma";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";

/** Listagens: capa + contagem (badge "X fotos"). */
export const PUBLIC_VEHICLE_CARD_INCLUDE = {
  photos: { orderBy: { order: "asc" as const }, take: 1 },
  _count: { select: { photos: true } },
};

/** Detalhe e edição carregam todas as fotos. */
export const PUBLIC_VEHICLE_INCLUDE = {
  photos: { orderBy: { order: "asc" as const } },
};

export const STOCK_PAGE_SIZE = 12;

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
        include: PUBLIC_VEHICLE_CARD_INCLUDE,
        orderBy: { createdAt: "desc" },
        take,
      });

      if (featured.length > 0) return featured;

      return prisma.vehicle.findMany({
        where: { status: "disponivel" },
        include: PUBLIC_VEHICLE_CARD_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 4,
      });
    },
    [],
  );
}

/** Para interesse/troca: não resolve veículos já vendidos. */
export function getVehicleById(id: string) {
  return safeQuery(
    `veículo ${id}`,
    () =>
      prisma.vehicle.findFirst({
        where: { id, status: { not: "vendido" } },
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
      const include = PUBLIC_VEHICLE_CARD_INCLUDE;
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
        include,
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
          include,
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
          include,
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
          include,
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
          include,
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
          include,
          orderBy: { createdAt: "desc" },
          take: take - merged.length,
        });
        return [...merged, ...extras];
      }

      if (byBrand.length > 0) return byBrand;

      return prisma.vehicle.findMany({
        where: base,
        include,
        orderBy: { createdAt: "desc" },
        take,
      });
    },
    [],
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
  vehicles: Array<
    Awaited<ReturnType<typeof prisma.vehicle.findMany>>[number] & {
      photos: Array<{ id: string; url: string; order: number; vehicleId: string }>;
      _count: { photos: number };
    }
  >;
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
    ...(filters.brand ? { brand: filters.brand } : {}),
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
      include: PUBLIC_VEHICLE_CARD_INCLUDE,
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
    [],
  );
}

export function getStockPage(filters: StockFilters): Promise<StockPageResult> {
  return safeQuery(
    "estoque",
    () => fetchStockPage(filters),
    {
      vehicles: [],
      total: 0,
      page: 1,
      pageSize: filters.pageSize ?? STOCK_PAGE_SIZE,
      totalPages: 1,
    },
  );
}

export function getStockFacets() {
  return safeQuery(
    "filtros do estoque",
    async () => {
      const rows = await prisma.vehicle.findMany({
        where: { status: "disponivel" },
        select: {
          category: true,
          brand: true,
          transmission: true,
          fuel: true,
          yearModel: true,
        },
      });

      const unique = (values: string[]) =>
        Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
          a.localeCompare(b, "pt-BR"),
        );

      return {
        categories: unique(rows.map((row) => row.category)),
        brands: unique(rows.map((row) => row.brand)),
        transmissions: unique(rows.map((row) => row.transmission)),
        fuels: unique(rows.map((row) => row.fuel)),
        years: Array.from(new Set(rows.map((row) => row.yearModel))).sort(
          (a, b) => b - a,
        ),
      };
    },
    {
      categories: [] as string[],
      brands: [],
      transmissions: [],
      fuels: [],
      years: [] as number[],
    },
  );
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
