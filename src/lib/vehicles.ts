import { buildStockFacets, type StockFacets } from "@/lib/stock-facets";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { stockSearchSuggestions, stockSearchWhere } from "@/lib/stock-search";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { brandKey, formatBrandName } from "@/lib/format";
import { extractVehicleIdFromParam, vehicleSlug } from "@/lib/vehicle-slug";
import { SEED_TESTIMONIALS } from "@/lib/testimonials-seed";
import { cleanTestimonialField } from "@/lib/testimonials-clean";
import {
  STOCK_PAGE_SIZE,
  isDailyStockSort,
  stockCityFilter,
  stockOrderBy,
  type StockFilters,
  type StockPageResult,
  type VehicleCardRecord,
} from "@/lib/stock-query";
import { orderStockDaily, saoPauloDateKey } from "@/lib/stock-daily-order";
import {
  colorWhere,
  transmissionWhere,
} from "@/lib/vehicle-display";
import { accessoryFilterVariants } from "@/lib/vehicle-accessories";
import { MAX_HOME_FEATURED } from "@/lib/featured";
import { queryPublicVehicleCards } from "@/lib/public-vehicle-cards";
import { PUBLIC_SITEMAP_VEHICLE_WHERE } from "@/lib/public-stock";
import { pickRelatedVehicles, priceBandRange } from "@/lib/related-vehicles";

export {
  STOCK_PAGE_SIZE,
  coverSrc,
  galleryPreviewSrc,
  galleryThumbSrc,
  parseStockFilters,
  type GalleryPhoto,
  type StockFilters,
  type StockPageResult,
  type VehicleCardPhoto,
  type VehicleCardRecord,
} from "@/lib/stock-query";

export { PUBLIC_VEHICLE_CARD_SELECT } from "@/lib/public-stock";

/** Tag do cache público — invalidada quando o estoque muda no admin. */
export const VEHICLES_PUBLIC_CACHE_TAG = "vehicles-public";
export const TESTIMONIALS_CACHE_TAG = "testimonials";

const PUBLIC_CACHE: { revalidate: number; tags: string[] } = {
  revalidate: 3600,
  tags: [VEHICLES_PUBLIC_CACHE_TAG],
};

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
  hasSpareKey: true,
  hasManual: true,
  hasVideo: true,
  status: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
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
  hasSpareKey: true,
  hasManual: true,
  hasVideo: true,
  status: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
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
  purchasePrice: true,
  consigned: true,
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
  hasSpareKey: boolean;
  hasManual: boolean;
  hasVideo: boolean;
  status: string;
  featured: boolean;
  locationCity?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  photos: Array<{ id: string; url: string; thumbnailUrl?: string | null }>;
};

export type SiteQueryMeta = {
  /** Preenchido quando a consulta falhou e o fallback foi usado. */
  error?: string;
};

export function attachQueryError<T>(
  fallback: T,
  message: string,
): T & SiteQueryMeta {
  if (Array.isArray(fallback)) {
    const clone = [...fallback] as unknown as T & SiteQueryMeta;
    Object.defineProperty(clone, "error", {
      value: message,
      enumerable: false,
      configurable: true,
    });
    return clone;
  }
  if (dataIsObject(fallback)) {
    return { ...fallback, error: message } as T & SiteQueryMeta;
  }
  return fallback as T & SiteQueryMeta;
}

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
    return attachQueryError(fallback, message);
  }
}

function dataIsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function findCardVehicles(
  args: Omit<Parameters<typeof prisma.vehicle.findMany>[0], "select">,
): Promise<VehicleCardRecord[]> {
  return queryPublicVehicleCards(args);
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
  return findCardVehicles({
    where: { status: "disponivel", featured: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

const loadFeaturedCached = unstable_cache(
  async (take: number) => fetchFeaturedVehicles(take),
  ["featured-vehicles-v7"],
  PUBLIC_CACHE,
);

export const getFeaturedVehicles = cache((take = MAX_HOME_FEATURED) =>
  safeQuery(
    "veículos em destaque",
    () => loadFeaturedCached(take),
    [] as VehicleCardRecord[],
  ),
);

/** Mesmo conjunto do /estoque sem filtro: todos os disponíveis, mais recentes primeiro. */
async function fetchCityShowcaseVehicles(): Promise<VehicleCardRecord[]> {
  return findCardVehicles({
    where: { status: "disponivel" },
    orderBy: { createdAt: "desc" },
  });
}

const loadCityShowcaseCached = unstable_cache(
  async () => fetchCityShowcaseVehicles(),
  ["city-showcase-v6"],
  PUBLIC_CACHE,
);

/** Landing de cidade: estoque disponível inteiro, sem recorte por cidade. */
export const getCityShowcaseVehicles = cache(() =>
  safeQuery(
    "vitrine da cidade",
    () => loadCityShowcaseCached(),
    [] as VehicleCardRecord[],
  ),
);

const loadVehiclesByIdsCached = unstable_cache(
  async (sortedIdsKey: string): Promise<VehicleCardRecord[]> => {
    const ids = sortedIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) return [];
    return findCardVehicles({
      where: { status: "disponivel", id: { in: ids } },
      orderBy: { createdAt: "desc" },
    });
  },
  ["vehicles-by-ids-v1"],
  PUBLIC_CACHE,
);

/** Busca somente os veículos disponíveis de uma lista de IDs (ex.: landings de marca/modelo). */
export const getVehiclesByIds = cache((ids: readonly string[]) => {
  const normalized = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
  if (normalized.length === 0) {
    return Promise.resolve([] as VehicleCardRecord[]);
  }
  return safeQuery(
    "veículos por id",
    () => loadVehiclesByIdsCached(normalized.join(",")),
    [] as VehicleCardRecord[],
  );
});

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
  ["vehicle-detail-v7"],
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

  return loadVehicleDetailCached(id);
});

async function findRelatedCardPool(where: {
  status: "disponivel";
  historical: false;
  id: { not: string };
  price: { gte: number; lte: number };
  category?: string;
}) {
  try {
    return await findCardVehicles({
      where: { ...where, consigned: false },
      orderBy: { price: "asc" },
    });
  } catch (error) {
    if (!isMissingColumnError(error, "consigned")) throw error;
    return findCardVehicles({
      where,
      orderBy: { price: "asc" },
    });
  }
}

async function fetchRelatedVehicles(
  vehicleId: string,
  brand: string,
  take: number,
  category: string,
  price: number,
  transmission: string,
): Promise<VehicleCardRecord[]> {
  const { min, max } = priceBandRange(price);
  if (max <= 0) return [];

  const pool = await findRelatedCardPool({
    status: "disponivel",
    historical: false,
    id: { not: vehicleId },
    price: { gte: min, lte: max },
    ...(category ? { category } : {}),
  });

  return pickRelatedVehicles(
    pool,
    { id: vehicleId, brand, category, price, transmission },
    take,
  );
}

const loadRelatedCached = unstable_cache(
  async (
    vehicleId: string,
    brand: string,
    take: number,
    category: string,
    price: number,
    transmission: string,
  ) =>
    fetchRelatedVehicles(
      vehicleId,
      brand,
      take,
      category,
      price,
      transmission,
    ),
  ["related-vehicles-v8"],
  PUBLIC_CACHE,
);

/**
 * Relacionados: mesmo tipo, perto no preço, com marca ou câmbio na frente
 * quando isso ainda enche o lote.
 */
export const getRelatedVehicles = cache(
  (
    vehicleId: string,
    brand: string,
    take = 4,
    category?: string,
    price?: number,
    transmission?: string,
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
          transmission ?? "",
        ),
      [] as VehicleCardRecord[],
    ),
);

function buildStockWhere(filters: StockFilters, catalog: { brand: string; model: string; version?: string | null }[] = []) {
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
  if (filters.accessories && filters.accessories.length > 0) {
    for (const acc of filters.accessories) {
      const variants = accessoryFilterVariants(acc);
      if (variants.length > 0) {
        and.push({ accessories: { hasSome: variants } });
      }
    }
  }
  and.push(...stockSearchWhere(filters.q ?? "", catalog));
  const gear = transmissionWhere(filters.transmission);
  if (Object.keys(gear).length > 0) and.push(gear);

  return {
    ...PUBLIC_SITEMAP_VEHICLE_WHERE,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.brand
      ? { brand: { equals: filters.brand, mode: "insensitive" as const } }
      : {}),
    ...((filters.model ?? "").trim()
      ? {
          model: {
            equals: (filters.model ?? "").trim(),
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(filters.fuel ? { fuel: filters.fuel } : {}),
    ...colorWhere(filters.color),
    ...priceFilter,
    ...yearFilter,
    ...(filters.maxKm ? { km: { lte: filters.maxKm } } : {}),
    ...stockCityFilter(filters.city),
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
    model: (filters.model ?? "").trim().toLocaleLowerCase("pt-BR"),
    transmission: filters.transmission ?? "",
    fuel: filters.fuel ?? "",
    color: (filters.color ?? "").trim().toLocaleLowerCase("pt-BR"),
    // hasEvery compara os valores exatos; o cache preserva o array e a grafia.
    accessories: [...(filters.accessories ?? [])].sort(),
    hasInspection: Boolean(filters.hasInspection),
    minPrice: filters.minPrice ?? 0,
    maxPrice: filters.maxPrice ?? 0,
    minYear: filters.minYear ?? 0,
    maxYear: filters.maxYear ?? 0,
    maxKm: filters.maxKm ?? 0,
    city: filters.city ?? "",
    sort: filters.sort ?? "destaques",
    ...(isDailyStockSort(filters.sort) ? { dateKey: saoPauloDateKey() } : {}),
    page,
    pageSize,
  });
}

const loadStockSearchCatalog = unstable_cache(
  () => prisma.vehicle.findMany({
    where: PUBLIC_SITEMAP_VEHICLE_WHERE, distinct: ["brand", "model", "version"],
    select: { brand: true, model: true, version: true },
  }),
  ["stock-search-catalog-v2"], PUBLIC_CACHE,
);

/** O mesmo conjunto ordenado atende todas as páginas sem repetir fotos/histórico. */
const loadDailyStockPoolCached = unstable_cache(
  async (key: string) => {
    const filters = JSON.parse(key) as StockFilters;
    const catalog = filters.q?.trim() ? await loadStockSearchCatalog() : [];
    return orderStockDaily(await findCardVehicles({
      where: buildStockWhere(filters, catalog),
      orderBy: stockOrderBy(filters.sort),
    }));
  },
  ["stock-daily-pool-v1"],
  PUBLIC_CACHE,
);

/** Total compartilhado entre páginas nas ordenações paginadas pelo banco. */
const loadStockCountCached = unstable_cache(
  async (key: string) => {
    const filters = JSON.parse(key) as StockFilters;
    const catalog = filters.q?.trim() ? await loadStockSearchCatalog() : [];
    return prisma.vehicle.count({ where: buildStockWhere(filters, catalog) });
  },
  ["stock-count-v1"],
  PUBLIC_CACHE,
);

async function fetchStockPage(filters: StockFilters): Promise<StockPageResult> {
  const pageSize = Math.min(
    Math.max(filters.pageSize ?? STOCK_PAGE_SIZE, 1),
    48,
  );
  const page = Math.max(filters.page ?? 1, 1);
  const catalog = filters.q?.trim() ? await loadStockSearchCatalog() : [];
  const where = buildStockWhere(filters, catalog);
  const orderBy = stockOrderBy(filters.sort);

  if (isDailyStockSort(filters.sort)) {
    const ordered = await loadDailyStockPoolCached(
      stockQueryKey({ ...filters, page: 1, pageSize: STOCK_PAGE_SIZE }),
    );
    const total = ordered.length;
    const startIndex = (page - 1) * pageSize;
    const vehicles = ordered.slice(startIndex, startIndex + pageSize);

    if (page > 1) {
      return {
        vehicles,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    const suggestions =
      total === 0 && filters.q?.trim()
        ? (
            await Promise.all(
              stockSearchSuggestions(filters.q, catalog).map(async (query) => ({
                query,
                count: await prisma.vehicle.count({
                  where: buildStockWhere({ ...filters, q: query }, catalog),
                }),
              })),
            )
          ).filter((item) => item.count > 0)
        : [];

    return {
      vehicles,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      ...(suggestions.length ? { suggestions } : {}),
    };
  }

  const [vehicles, total] = await Promise.all([
    findCardVehicles({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    loadStockCountCached(stockQueryKey({ ...filters, page: 1, pageSize: STOCK_PAGE_SIZE })),
  ]);

  // Página 2+ mantém o total real sem repetir a contagem no banco.
  if (page > 1) {
    return {
      vehicles,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // Só após resultado vazio. Cada sugestão é conferida com TODOS os filtros atuais.
  const suggestions = total === 0 && filters.q?.trim()
    ? (await Promise.all(stockSearchSuggestions(filters.q, catalog).map(async query => ({
        query, count: await prisma.vehicle.count({ where: buildStockWhere({ ...filters, q: query }, catalog) }),
      })))).filter(item => item.count > 0)
    : [];

  return {
    vehicles,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    ...(suggestions.length ? { suggestions } : {}),
  };
}

const loadStockPageCached = unstable_cache(
  async (key: string) => fetchStockPage(JSON.parse(key) as StockFilters),
  ["stock-page-v17"],
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

const STOCK_CATALOG_SELECT = {
  id: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  price: true,
  createdAt: true,
} as const;

export type StockCatalogLink = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  price: number;
  createdAt: Date | string;
};

/**
 * Todas as fichas disponíveis, na ordem da listagem (destaques do dia).
 * A grade visível continua em lotes de 8; este índice entra no HTML
 * para o crawler abrir cada anúncio sem rodar o scroll infinito.
 */
async function loadStockCatalogLinks(): Promise<StockCatalogLink[]> {
  const orderBy = { createdAt: "desc" as const };
  let links: StockCatalogLink[];
  try {
    links = await prisma.vehicle.findMany({
      where: PUBLIC_SITEMAP_VEHICLE_WHERE,
      select: STOCK_CATALOG_SELECT,
      orderBy,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "historical")) throw error;
    links = await prisma.vehicle.findMany({
      where: { status: "disponivel" },
      select: STOCK_CATALOG_SELECT,
      orderBy,
    });
  }
  return orderStockDaily(links);
}

const loadStockCatalogCached = unstable_cache(
  async (_dateKey: string) => loadStockCatalogLinks(),
  ["stock-catalog-links-v2"],
  PUBLIC_CACHE,
);

export const getStockCatalogLinks = cache(() =>
  safeQuery(
    "índice do estoque",
    () => loadStockCatalogCached(saoPauloDateKey()),
    [] as StockCatalogLink[],
  ),
);

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

const EMPTY_FACETS: StockFacets = {
  categories: [],
  brands: [],
  models: [],
  transmissions: [],
  fuels: [],
  colors: [],
  accessories: [],
  years: [],
};

const loadStockFacetsCached = unstable_cache(
  async (): Promise<StockFacets> => {
    // Uma projeção enxuta substitui oito consultas e exclui veículos históricos.
    const rows = await prisma.vehicle.findMany({
      where: PUBLIC_SITEMAP_VEHICLE_WHERE,
      select: {
        category: true, brand: true, model: true, transmission: true,
        fuel: true, color: true, yearModel: true, accessories: true,
      },
      orderBy: { brand: "asc" },
    });
    return buildStockFacets(rows);
  },
  ["stock-facets-v7"],
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

/** Igual ao estoque: a home também lê depoimentos, e o menor cache da rota vira o ISR. */
const TESTIMONIALS_CACHE: { revalidate: number; tags: string[] } = {
  revalidate: 3600,
  tags: [TESTIMONIALS_CACHE_TAG],
};

function testimonialsFromSeed() {
  return SEED_TESTIMONIALS.map((item, index) => ({
    id: `seed-${index}`,
    name: cleanTestimonialField(item.name) ?? item.name,
    city: cleanTestimonialField(item.city),
    message: cleanTestimonialField(item.message) ?? item.message,
    photoUrl: null as string | null,
    rating: item.rating,
    vehicleLabel: cleanTestimonialField(item.vehicleLabel) ?? null,
    createdAt: null as Date | null,
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
  createdAt: true,
} as const;

const TESTIMONIAL_SELECT_LEGACY = {
  id: true,
  name: true,
  city: true,
  message: true,
  photoUrl: true,
  vehicleLabel: true,
  createdAt: true,
} as const;

async function fetchPublishedTestimonials(take: number) {
  try {
    const rows = await prisma.testimonial.findMany({
      where: { published: true },
      select: TESTIMONIAL_SELECT,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take,
    });

    return rows.map((item) => ({
      ...item,
      name: cleanTestimonialField(item.name) ?? item.name,
      city: cleanTestimonialField(item.city),
      vehicleLabel: cleanTestimonialField(item.vehicleLabel),
      message: cleanTestimonialField(item.message) ?? item.message,
    }));
  } catch (error) {
    if (!isMissingColumnError(error, "rating")) throw error;
    const rows = await prisma.testimonial.findMany({
      where: { published: true },
      select: TESTIMONIAL_SELECT_LEGACY,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map((item) => ({
      ...item,
      name: cleanTestimonialField(item.name) ?? item.name,
      city: cleanTestimonialField(item.city),
      vehicleLabel: cleanTestimonialField(item.vehicleLabel),
      message: cleanTestimonialField(item.message) ?? item.message,
      rating: 5,
    }));
  }
}

const loadTestimonialsCached = unstable_cache(
  async (take: number) => fetchPublishedTestimonials(take),
  ["testimonials-v6"],
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
      name: cleanTestimonialField(item.name) ?? item.name,
      city: cleanTestimonialField(item.city),
      vehicleLabel: cleanTestimonialField(item.vehicleLabel),
      message: cleanTestimonialField(item.message) ?? item.message,
      rating: Math.min(5, Math.max(1, item.rating || 5)),
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
