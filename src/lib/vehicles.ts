import { prisma } from "@/lib/prisma";

export const PUBLIC_VEHICLE_INCLUDE = {
  photos: { orderBy: { order: "asc" as const } },
};

/**
 * O site público nunca deve quebrar por indisponibilidade do banco: cada
 * consulta devolve um fallback vazio e registra o erro no servidor.
 */
async function safeQuery<T>(label: string, run: () => Promise<T>, fallback: T) {
  try {
    return await run();
  } catch (error) {
    console.error(`[site] falha ao consultar ${label}:`, error);
    return fallback;
  }
}

export function getFeaturedVehicles(take = 8) {
  return safeQuery(
    "veículos em destaque",
    async () => {
      const featured = await prisma.vehicle.findMany({
        where: { status: "disponivel", featured: true },
        include: PUBLIC_VEHICLE_INCLUDE,
        orderBy: { createdAt: "desc" },
        take,
      });

      if (featured.length > 0) return featured;

      return prisma.vehicle.findMany({
        where: { status: "disponivel" },
        include: PUBLIC_VEHICLE_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 4,
      });
    },
    [],
  );
}

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

export function getRelatedVehicles(vehicleId: string, brand: string, take = 4) {
  return safeQuery(
    "veículos relacionados",
    () =>
      prisma.vehicle.findMany({
        where: { status: "disponivel", brand, id: { not: vehicleId } },
        include: PUBLIC_VEHICLE_INCLUDE,
        orderBy: { createdAt: "desc" },
        take,
      }),
    [],
  );
}

export type StockFilters = {
  q?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  maxPrice?: number;
  minYear?: number;
  maxKm?: number;
  sort?: string;
};

const SORT_MAP: Record<string, { [key: string]: "asc" | "desc" }> = {
  recentes: { createdAt: "desc" },
  "menor-preco": { price: "asc" },
  "maior-preco": { price: "desc" },
  "menor-km": { km: "asc" },
  "mais-novo": { yearModel: "desc" },
};

export function getStockVehicles(filters: StockFilters) {
  const terms = (filters.q ?? "").trim().split(/\s+/).filter(Boolean);

  return safeQuery(
    "estoque",
    () =>
      prisma.vehicle.findMany({
        where: {
          status: "disponivel",
          ...(filters.brand ? { brand: filters.brand } : {}),
          ...(filters.transmission ? { transmission: filters.transmission } : {}),
          ...(filters.fuel ? { fuel: filters.fuel } : {}),
          ...(filters.maxPrice ? { price: { lte: filters.maxPrice } } : {}),
          ...(filters.minYear ? { yearModel: { gte: filters.minYear } } : {}),
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
        },
        include: PUBLIC_VEHICLE_INCLUDE,
        orderBy: SORT_MAP[filters.sort ?? "recentes"] ?? SORT_MAP.recentes,
      }),
    [],
  );
}

export function getStockFacets() {
  return safeQuery(
    "filtros do estoque",
    async () => {
      const rows = await prisma.vehicle.findMany({
        where: { status: "disponivel" },
        select: {
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
        brands: unique(rows.map((row) => row.brand)),
        transmissions: unique(rows.map((row) => row.transmission)),
        fuels: unique(rows.map((row) => row.fuel)),
        years: Array.from(new Set(rows.map((row) => row.yearModel))).sort(
          (a, b) => b - a,
        ),
      };
    },
    { brands: [], transmissions: [], fuels: [], years: [] as number[] },
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
