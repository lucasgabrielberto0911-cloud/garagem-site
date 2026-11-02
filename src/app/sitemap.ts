import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getStockLandingHistory } from "@/lib/stock-landing-data";
import { stockLandingLinks } from "@/lib/stock-landings";
import { BUYING_GUIDES } from "@/lib/buying-guides";
import type { MetadataRoute } from "next";
import { publicPhotoSrc } from "@/lib/public-photo-url";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { PUBLIC_SITEMAP_VEHICLE_WHERE } from "@/lib/public-stock";
import {
  CITIES_DIRECTORY_PATH,
  SERVICE_CITIES,
  absoluteUrl,
} from "@/lib/seo";
import { vehiclePath } from "@/lib/vehicle-slug";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";

export const revalidate = 300;

const STOCK_DRIVEN_STATIC_PATHS = new Set<string>([
  "/",
  "/estoque",
  "/modelos",
  "/seminovos",
  ...SERVICE_CITIES.map((city) => `/seminovos/${city.slug}`),
]);

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/modelos", changeFrequency: "weekly", priority: 0.7 },
  { path: "/guias", changeFrequency: "monthly", priority: 0.5 },
  ...BUYING_GUIDES.map(guide => ({ path: `/guias/${guide.slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/estoque", changeFrequency: "daily", priority: 0.9 },
  { path: "/pedido", changeFrequency: "monthly", priority: 0.4 },
  { path: "/vender", changeFrequency: "monthly", priority: 0.8 },
  { path: "/sobre", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contato", changeFrequency: "yearly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacidade", changeFrequency: "yearly", priority: 0.3 },
  { path: "/seminovos", changeFrequency: "weekly", priority: 0.75 },
  { path: CITIES_DIRECTORY_PATH, changeFrequency: "monthly", priority: 0.65 },
  ...SERVICE_CITIES.map((city) => ({
    path: `/seminovos/${city.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let vehicles: {
    id: string;
    brand: string;
    model: string;
    version: string | null;
    yearModel: number;
    updatedAt: Date | string;
    photos: { url: string }[];
  }[] = [];
  try {
    vehicles = await getCachedPublicSitemapVehicles();
  } catch (error) {
    console.error("[sitemap] falha ao listar veículos:", error);
  }

  let landings: ReturnType<typeof stockLandingLinks> = [];
  try { landings = stockLandingLinks(await getStockLandingHistory()); }
  catch (error) { console.error("[sitemap] falha ao listar marcas e modelos:", error); }

  const latestStockDate = resolveLatestStockDate(vehicles, landings);

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      ...(latestStockDate && STOCK_DRIVEN_STATIC_PATHS.has(route.path)
        ? { lastModified: latestStockDate }
        : {}),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...landings.map((link) => ({
      url: absoluteUrl(link.path),
      ...(link.lastModified ? { lastModified: link.lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...vehicles.map((vehicle) => {
      const images = [
        ...new Set(
          vehicle.photos
            .map((photo) => (photo.url ? absoluteUrl(publicPhotoSrc(photo.url)) : ""))
            .filter(Boolean),
        ),
      ];
      return {
        url: absoluteUrl(vehiclePath(vehicle)),
        lastModified: new Date(vehicle.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.7,
        images,
      };
    }),
  ];
}

function resolveLatestStockDate(
  vehicles: { updatedAt: Date | string }[],
  landings: { lastModified?: Date }[],
): Date | undefined {
  let latest: Date | undefined;
  for (const vehicle of vehicles) {
    const date = new Date(vehicle.updatedAt);
    if (!Number.isNaN(date.getTime()) && (!latest || date > latest)) {
      latest = date;
    }
  }
  for (const landing of landings) {
    if (landing.lastModified && (!latest || landing.lastModified > latest)) {
      latest = landing.lastModified;
    }
  }
  return latest;
}

const getCachedPublicSitemapVehicles = cache(
  unstable_cache(loadPublicSitemapVehicles, ["public-sitemap-vehicles-v1"], {
    revalidate: 3600,
    tags: [VEHICLES_PUBLIC_CACHE_TAG],
  }),
);

async function loadPublicSitemapVehicles() {
  const select = {
    id: true,
    brand: true,
    model: true,
    version: true,
    yearModel: true,
    updatedAt: true,
    photos: { select: { url: true }, orderBy: { order: "asc" as const } },
  } as const;

  try {
    return await prisma.vehicle.findMany({
      where: PUBLIC_SITEMAP_VEHICLE_WHERE,
      select,
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    if (!isMissingColumnError(error, "historical")) throw error;
    return prisma.vehicle.findMany({
      where: { status: "disponivel" },
      select,
      orderBy: { updatedAt: "desc" },
    });
  }
}
