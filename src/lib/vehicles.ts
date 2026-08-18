import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { brandKey, formatBrandName } from "@/lib/format";
import { extractVehicleIdFromParam, vehicleSlug } from "@/lib/vehicle-slug";

/** Tag do cache público — invalidada quando o estoque muda no admin. */
export const VEHICLES_PUBLIC_CACHE_TAG = "vehicles-public";

const PUBLIC_CACHE: { revalidate: number; tags: string[] } = {
  revalidate: 60,
  tags: [VEHICLES_PUBLIC_CACHE_TAG],
};

/**
 * Campos mínimos do card de listagem (estoque / home / relacionados).
 * Só a capa — sem count de fotos (subquery extra por linha).
 */
export const PUBLIC_VEHICLE_CARD_SELECT = {
  id: true,
  category: true,
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
    select: { url: true },
  },
} as const;

/** Anúncio público: sem FIPE, placa, compra, custos ou documentos. */
export const PUBLIC_VEHICLE_DETAIL_SELECT = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  year: true,
  yearModel: true,
  km: true,
  price: true,
  fuel: true,
  transmission: true,
  color: true,
  description: true,
  engine: true,
  doors: true,
  warranty: true,
  plateEnd: true,
  inspection: true,
  accessories: true,
  status: true,
  featured: true,
  photos: {
    orderBy: { order: "asc" as const },
    select: { id: true, url: true },
  },
} as const;

/** @deprecated Prefira PUBLIC_VEHICLE_CARD_SELECT. */
export const PUBLIC_VEHICLE_CARD_INCLUDE = {
  photos: { orderBy: { order: "asc" as const }, take: 1 },
} as const;

/** @deprecated Prefira PUBLIC_VEHICLE_DETAIL_SELECT. */
export const PUBLIC_VEHICLE_INCLUDE = {
  photos: { orderBy: { order: "asc" as const } },
} as const;

/** Nunca enviar preço FIPE, placa completa nem dados de operação ao site. */
export const PUBLIC_VEHICLE_OMIT = {
  fipePrice: true,
  plate: true,
  inStoreName: true,
  hasSpareKey: true,
  hasManual: true,
  purchasePrice: true,
} as const;

export const STOCK_PAGE_SIZE = 12;

export type VehicleCardRecord = {
  id: string;
  category?: string;
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
  photos: Array<{ url: string }>;
};

export type PublicVehicleDetail = {
  id: string;
  category: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  yearModel: number;
  km: number;
  price: number;
  fuel: string;
  transmission: string;
  color: string | null;
  description: string | null;
  engine: string | null;
  doors: number | null;
  warranty: string | null;
  plateEnd: string | null;
  inspection: string | null;
  accessories: string[];
  status: string;
  featured: boolean;
  photos: Array<{ id: string; url: string }>;
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

async function fetchFeaturedVehicles(take: number): Promise<VehicleCardRecord[]> {
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
    take: Math.min(take, 4),
  });
}

const loadFeaturedCached = unstable_cache(
  async (take: number) => fetchFeaturedVehicles(take),
  ["featured-vehicles-v3"],
  PUBLIC_CACHE,
);

export const getFeaturedVehicles = cache((take = 8) =>
  safeQuery(
    "veículos em destaque",
    () => loadFeaturedCached(take),
    [] as VehicleCardRecord[],
  ),
);

const loadVehicleByIdCached = unstable_cache(
  async (id: string) =>
    prisma.vehicle.findFirst({
      where: { id, status: { not: "vendido" } },
      select: {
        id: true,
        brand: true,
        model: true,
        yearModel: true,
      },
    }),
  ["vehicle-interest-v1"],
  PUBLIC_CACHE,
);

/** Para interesse/troca: não resolve veículos já vendidos. */
export const getVehicleById = cache((id: string) =>
  safeQuery(`veículo ${id}`, () => loadVehicleByIdCached(id), null),
);

const loadVehicleDetailCached = unstable_cache(
  async (id: string) =>
    prisma.vehicle.findFirst({
      where: { id, historical: false },
      select: PUBLIC_VEHICLE_DETAIL_SELECT,
    }),
  ["vehicle-detail-v3"],
  PUBLIC_CACHE,
);

/**
 * Resolve por cuid ou slug SEO (`marca-modelo-ano-{cuid}`).
 * Inclui vendidos para a página de detalhe não retornar 404 após a venda.
 * Deduplica generateMetadata + page no mesmo request e cacheia 60s.
 */
export const getVehicleByParam = cache(async (param: string) => {
  const id = extractVehicleIdFromParam(param);
  if (!id) return null;

  return safeQuery(
    `veículo ${id}`,
    () => loadVehicleDetailCached(id),
    null,
  );
});

function relatedScore(
  item: VehicleCardRecord,
  brand: string,
  category: string,
  price: number,
) {
  let score = 0;
  if (item.brand.localeCompare(brand, "pt-BR", { sensitivity: "accent" }) === 0) {
    score += 8;
  }
  if (category && item.category === category) score += 4;
  if (price > 0) {
    const diff = Math.abs(item.price - price) / price;
    if (diff <= 0.25) score += 3;
    else if (diff <= 0.4) score += 1;
  }
  if (item.featured) score += 1;
  return score;
}

async function fetchRelatedVehicles(
  vehicleId: string,
  brand: string,
  take: number,
  category: string,
  price: number,
): Promise<VehicleCardRecord[]> {
  const pool = await prisma.vehicle.findMany({
    where: { status: "disponivel", id: { not: vehicleId } },
    select: PUBLIC_VEHICLE_CARD_SELECT,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 48,
  });

  return [...pool]
    .sort(
      (a, b) =>
        relatedScore(b, brand, category, price) -
        relatedScore(a, brand, category, price),
    )
    .slice(0, take);
}

const loadRelatedCached = unstable_cache(
  async (
    vehicleId: string,
    brand: string,
    take: number,
    category: string,
    price: number,
  ) => fetchRelatedVehicles(vehicleId, brand, take, category, price),
  ["related-vehicles-v3"],
  PUBLIC_CACHE,
);

/**
 * Relacionados: uma consulta ao pool recente, ranqueada por marca/categoria/preço.
 */
export const getRelatedVehicles = cache(
  (
    vehicleId: string,
    brand: string,
    take = 4,
    category?: string,
    price?: number,
  ) =>
    safeQuery(
      "veículos relacionados",
      () =>
        loadRelatedCached(
          vehicleId,
          brand,
          take,
          category ?? "",
          price && price > 0 ? price : 0,
        ),
      [] as VehicleCardRecord[],
    ),
);

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

function stockQueryKey(filters: StockFilters) {
  const pageSize = Math.min(
    Math.max(filters.pageSize ?? STOCK_PAGE_SIZE, 1),
    48,
  );
  const page = Math.max(filters.page ?? 1, 1);
  return JSON.stringify({
    q: (filters.q ?? "").trim(),
    category: filters.category ?? "",
    brand: filters.brand ?? "",
    transmission: filters.transmission ?? "",
    fuel: filters.fuel ?? "",
    minPrice: filters.minPrice ?? 0,
    maxPrice: filters.maxPrice ?? 0,
    minYear: filters.minYear ?? 0,
    maxYear: filters.maxYear ?? 0,
    maxKm: filters.maxKm ?? 0,
    sort: filters.sort ?? "recentes",
    page,
    pageSize,
  });
}

async function fetchStockPage(filters: StockFilters): Promise<StockPageResult> {
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

const loadStockPageCached = unstable_cache(
  async (key: string) => fetchStockPage(JSON.parse(key) as StockFilters),
  ["stock-page-v3"],
  PUBLIC_CACHE,
);

/** @deprecated Use getStockPage — mantido para callers simples. */
export function getStockVehicles(filters: StockFilters) {
  return safeQuery(
    "estoque",
    async () => {
      const result = await loadStockPageCached(
        stockQueryKey({ ...filters, page: 1, pageSize: 48 }),
      );
      return result.vehicles;
    },
    [] as VehicleCardRecord[],
  );
}

export const getStockPage = cache(
  (filters: StockFilters): Promise<StockPageResult> =>
    safeQuery(
      "estoque",
      () => loadStockPageCached(stockQueryKey(filters)),
      {
        vehicles: [] as VehicleCardRecord[],
        total: 0,
        page: 1,
        pageSize: filters.pageSize ?? STOCK_PAGE_SIZE,
        totalPages: 1,
      },
    ),
);

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
  ["stock-facets-v3"],
  PUBLIC_CACHE,
);

export const getStockFacets = cache(() =>
  safeQuery("filtros do estoque", () => loadStockFacetsCached(), EMPTY_FACETS),
);

const EMPTY_STATS = {
  availableLive: 0,
  salesLive: 0,
  stockBase: 0,
  salesBase: 0,
  available: 0,
  sales: 0,
};

const loadSiteStatsCached = unstable_cache(
  async () => {
    const [availableLive, salesLive, settings] = await Promise.all([
      prisma.vehicle.count({ where: { status: "disponivel" } }),
      prisma.sale.count(),
      prisma.siteSettings.findUnique({
        where: { id: "default" },
        select: {
          statsStockBase: true,
          statsSalesBase: true,
          aboutSold: true,
        },
      }),
    ]);

    const stockBase = settings?.statsStockBase ?? 0;
    const salesBaseFromRow = settings?.statsSalesBase ?? 0;
    const salesBase =
      salesBaseFromRow > 0
        ? salesBaseFromRow
        : Number(String(settings?.aboutSold ?? "").replace(/\D/g, "") || 0);

    return {
      availableLive,
      salesLive,
      stockBase,
      salesBase,
      available: availableLive + stockBase,
      sales: salesLive + salesBase,
    };
  },
  ["site-stats-v3"],
  PUBLIC_CACHE,
);

export const getSiteStats = cache(() =>
  safeQuery("estatísticas", () => loadSiteStatsCached(), EMPTY_STATS),
);

const loadTestimonialsCached = unstable_cache(
  async (take: number) =>
    prisma.testimonial.findMany({
      where: { published: true },
      select: {
        id: true,
        name: true,
        city: true,
        message: true,
        photoUrl: true,
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take,
    }),
  ["testimonials-v3"],
  PUBLIC_CACHE,
);

export const getTestimonials = cache((take = 6) =>
  safeQuery("depoimentos", () => loadTestimonialsCached(take), []),
);

/** Pré-gera os anúncios ativos no build / ISR. Falha de banco não quebra o build. */
export async function getPublicVehicleStaticParams() {
  try {
    const vehicles = await prisma.vehicle.findMany({
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
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    });
    return vehicles.map((vehicle) => ({ id: vehicleSlug(vehicle) }));
  } catch (error) {
    console.error("[site] falha ao pré-gerar anúncios:", error);
    return [] as Array<{ id: string }>;
  }
}
