import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { brandKey, formatBrandName } from "@/lib/format";
import { extractVehicleIdFromParam, vehicleSlug } from "@/lib/vehicle-slug";
import { SEED_TESTIMONIALS } from "@/lib/testimonials-seed";
import {
  STOCK_PAGE_SIZE,
  type StockFilters,
  type StockPageResult,
  type VehicleCardRecord,
} from "@/lib/stock-query";

export {
  STOCK_PAGE_SIZE,
  coverSrc,
  galleryThumbSrc,
  parseStockFilters,
  type GalleryPhoto,
  type StockFilters,
  type StockPageResult,
  type VehicleCardPhoto,
  type VehicleCardRecord,
} from "@/lib/stock-query";

/** Tag do cache público — invalidada quando o estoque muda no admin. */
export const VEHICLES_PUBLIC_CACHE_TAG = "vehicles-public";
export const TESTIMONIALS_CACHE_TAG = "testimonials";

const PUBLIC_CACHE: { revalidate: number; tags: string[] } = {
  revalidate: 120,
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
    select: { url: true, thumbnailUrl: true },
  },
} as const;

const PUBLIC_VEHICLE_CARD_SELECT_LEGACY = {
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
  createdAt: true,
  photos: {
    orderBy: { order: "asc" as const },
    select: { id: true, url: true, thumbnailUrl: true },
  },
} as const;

const PUBLIC_VEHICLE_DETAIL_SELECT_LEGACY = {
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
  createdAt: true,
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
  createdAt: Date;
  photos: Array<{ id: string; url: string; thumbnailUrl?: string | null }>;
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

async function findCardVehicles(
  args: Omit<Parameters<typeof prisma.vehicle.findMany>[0], "select">,
): Promise<VehicleCardRecord[]> {
  try {
    return (await prisma.vehicle.findMany({
      ...args,
      select: PUBLIC_VEHICLE_CARD_SELECT,
    })) as VehicleCardRecord[];
  } catch (error) {
    if (!isMissingColumnError(error, "thumbnailUrl")) throw error;
    const rows = await prisma.vehicle.findMany({
      ...args,
      select: PUBLIC_VEHICLE_CARD_SELECT_LEGACY,
    });
    return rows.map((row) => ({
      ...row,
      photos: row.photos.map((photo) => ({ ...photo, thumbnailUrl: null })),
    }));
  }
}

async function findDetailVehicle(
  id: string,
): Promise<PublicVehicleDetail | null> {
  try {
    return (await prisma.vehicle.findFirst({
      where: { id, historical: false },
      select: PUBLIC_VEHICLE_DETAIL_SELECT,
    })) as PublicVehicleDetail | null;
  } catch (error) {
    if (!isMissingColumnError(error, "thumbnailUrl")) throw error;
    const row = await prisma.vehicle.findFirst({
      where: { id, historical: false },
      select: PUBLIC_VEHICLE_DETAIL_SELECT_LEGACY,
    });
    if (!row) return null;
    return {
      ...row,
      photos: row.photos.map((photo) => ({ ...photo, thumbnailUrl: null })),
    };
  }
}

async function fetchFeaturedVehicles(take: number): Promise<VehicleCardRecord[]> {
  const featured = await findCardVehicles({
    where: { status: "disponivel", featured: true },
    orderBy: { createdAt: "desc" },
    take,
  });

  if (featured.length > 0) return featured;

  return findCardVehicles({
    where: { status: "disponivel" },
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 4),
  });
}

const loadFeaturedCached = unstable_cache(
  async (take: number) => fetchFeaturedVehicles(take),
  ["featured-vehicles-v4"],
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
  async (id: string) => findDetailVehicle(id),
  ["vehicle-detail-v4"],
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
  const pool = await findCardVehicles({
    where: { status: "disponivel", id: { not: vehicleId } },
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
  ["related-vehicles-v4"],
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

  const and: object[] = [];
  if (filters.hasInspection) {
    and.push({ inspection: { not: null } }, { inspection: { not: "" } });
  }
  if (terms.length) {
    and.push(
      ...terms.map((term) => ({
        OR: [
          { brand: { contains: term, mode: "insensitive" as const } },
          { model: { contains: term, mode: "insensitive" as const } },
          { version: { contains: term, mode: "insensitive" as const } },
        ],
      })),
    );
  }

  return {
    status: "disponivel" as const,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.brand
      ? { brand: { equals: filters.brand, mode: "insensitive" as const } }
      : {}),
    ...(filters.transmission ? { transmission: filters.transmission } : {}),
    ...(filters.fuel ? { fuel: filters.fuel } : {}),
    ...(filters.color
      ? { color: { equals: filters.color, mode: "insensitive" as const } }
      : {}),
    ...(filters.accessories && filters.accessories.length > 0
      ? { accessories: { hasEvery: filters.accessories } }
      : {}),
    ...priceFilter,
    ...yearFilter,
    ...(filters.maxKm ? { km: { lte: filters.maxKm } } : {}),
    ...(and.length ? { AND: and } : {}),
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
    color: (filters.color ?? "").trim().toLocaleLowerCase("pt-BR"),
    accessories: (filters.accessories ?? [])
      .map((item) => item.toLocaleLowerCase("pt-BR"))
      .sort()
      .join("|"),
    hasInspection: Boolean(filters.hasInspection),
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
    findCardVehicles({
      where,
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
  ["stock-page-v5"],
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
  colors: string[];
  accessories: string[];
  years: number[];
};

const EMPTY_FACETS: StockFacets = {
  categories: [],
  brands: [],
  transmissions: [],
  fuels: [],
  colors: [],
  accessories: [],
  years: [],
};

const loadStockFacetsCached = unstable_cache(
  async (): Promise<StockFacets> => {
    const available = { status: "disponivel" as const };

    const [categories, brands, transmissions, fuels, colors, years, accessoryRows] =
      await Promise.all([
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
        by: ["color"],
        where: available,
        orderBy: { color: "asc" },
      }),
      prisma.vehicle.groupBy({
        by: ["yearModel"],
        where: available,
        orderBy: { yearModel: "desc" },
      }),
      prisma.vehicle.findMany({
        where: available,
        select: { accessories: true },
        take: 400,
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

    const accessoryByKey = new Map<string, string>();
    for (const row of accessoryRows) {
      for (const item of row.accessories) {
        const raw = item?.trim();
        if (!raw) continue;
        const key = raw.toLocaleLowerCase("pt-BR");
        if (!accessoryByKey.has(key)) accessoryByKey.set(key, raw);
      }
    }

    return {
      categories: unique(categories.map((row) => row.category)),
      brands: Array.from(brandsByKey.values()).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
      transmissions: unique(transmissions.map((row) => row.transmission)),
      fuels: unique(fuels.map((row) => row.fuel)),
      colors: unique(
        colors
          .map((row) => row.color?.trim() ?? "")
          .filter(Boolean),
      ),
      accessories: Array.from(accessoryByKey.values()).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
      years: years.map((row) => row.yearModel),
    };
  },
  ["stock-facets-v4"],
  PUBLIC_CACHE,
);

export const getStockFacets = cache(() =>
  safeQuery("filtros do estoque", () => loadStockFacetsCached(), EMPTY_FACETS),
);

const loadStockBrandsCached = unstable_cache(
  async (take: number) => {
    const rows = await prisma.vehicle.groupBy({
      by: ["brand"],
      where: { status: "disponivel" },
      _count: { _all: true },
      orderBy: { _count: { brand: "desc" } },
      take,
    });

    const brandsByKey = new Map<string, string>();
    for (const row of rows) {
      const raw = row.brand?.trim();
      if (!raw) continue;
      const key = brandKey(raw);
      if (!brandsByKey.has(key)) {
        brandsByKey.set(key, formatBrandName(raw));
      }
    }
    return Array.from(brandsByKey.values());
  },
  ["stock-brands-v1"],
  PUBLIC_CACHE,
);

/** Só as marcas mais presentes — home/hero, sem as 7 consultas de facets. */
export const getStockBrands = cache((take = 5) =>
  safeQuery("marcas do estoque", () => loadStockBrandsCached(take), [] as string[]),
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

const TESTIMONIALS_CACHE: { revalidate: number; tags: string[] } = {
  revalidate: 60,
  tags: [TESTIMONIALS_CACHE_TAG],
};

function testimonialsFromSeed() {
  return SEED_TESTIMONIALS.map((item, index) => ({
    id: `seed-${index}`,
    name: item.name,
    city: item.city,
    message: item.message,
    photoUrl: null as string | null,
    rating: item.rating,
    vehicleLabel: item.vehicleLabel ?? null,
  }));
}

const TESTIMONIAL_SELECT = {
  id: true,
  name: true,
  city: true,
  message: true,
  photoUrl: true,
  rating: true,
  vehicleLabel: true,
} as const;

const TESTIMONIAL_SELECT_LEGACY = {
  id: true,
  name: true,
  city: true,
  message: true,
  photoUrl: true,
  vehicleLabel: true,
} as const;

async function fetchPublishedTestimonials(take: number) {
  try {
    return await prisma.testimonial.findMany({
      where: { published: true },
      select: TESTIMONIAL_SELECT,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "rating")) throw error;
    const rows = await prisma.testimonial.findMany({
      where: { published: true },
      select: TESTIMONIAL_SELECT_LEGACY,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map((item) => ({ ...item, rating: 5 }));
  }
}

const loadTestimonialsCached = unstable_cache(
  async (take: number) => fetchPublishedTestimonials(take),
  ["testimonials-v5"],
  TESTIMONIALS_CACHE,
);

export const getTestimonials = cache(async (take = 6) => {
  const fromDb = await safeQuery(
    "depoimentos",
    () => loadTestimonialsCached(take),
    [] as Awaited<ReturnType<typeof loadTestimonialsCached>>,
  );
  if (fromDb.length > 0) {
    return fromDb.map((item) => ({
      ...item,
      rating: Math.min(5, Math.max(1, item.rating || 5)),
      vehicleLabel: item.vehicleLabel ?? null,
    }));
  }
  return testimonialsFromSeed().slice(0, take);
});

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
    });
    return vehicles.map((vehicle) => ({ id: vehicleSlug(vehicle) }));
  } catch (error) {
    console.error("[site] falha ao pré-gerar anúncios:", error);
    return [] as Array<{ id: string }>;
  }
}
