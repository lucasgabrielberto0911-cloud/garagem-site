import { NextResponse } from "next/server";
import { buildCatalogCsv, type CatalogFeedVehicle } from "@/lib/catalog-feed";
import { queryCatalogVehicles, type CatalogWhere } from "@/lib/catalog-feed-query";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";

/**
 * CDN só. Sem `revalidate` / `revalidatePath`: o feed não entra no ISR
 * (cada gravação de estoque já reescreve home, listagem e a ficha).
 */
export const CATALOG_CACHE_CONTROL =
  "public, s-maxage=900, stale-while-revalidate=86400";

const PHOTO_SELECT = {
  orderBy: { order: "asc" as const },
  select: { id: true, url: true },
};

const CATALOG_SELECT = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  km: true,
  price: true,
  fuel: true,
  transmission: true,
  color: true,
  description: true,
  engine: true,
  locationCity: true,
  photos: PHOTO_SELECT,
} as const;

const CATALOG_SELECT_LEGACY = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  km: true,
  price: true,
  fuel: true,
  transmission: true,
  color: true,
  description: true,
  engine: true,
  photos: PHOTO_SELECT,
} as const;

async function findCatalog(where: CatalogWhere, legacy: boolean) {
  return prisma.vehicle.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 400,
    select: legacy ? CATALOG_SELECT_LEGACY : CATALOG_SELECT,
  });
}

function csvResponse(csv: string, cache: boolean) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": cache ? CATALOG_CACHE_CONTROL : "no-store",
      "Content-Disposition": 'inline; filename="garagem-estoque-meta.csv"',
    },
  });
}

/** Consignado nunca entra: a query não lê parâmetro algum (`?consigned=` é ignorado). */
export async function catalogCsvResponse() {
  try {
    const vehicles = (await queryCatalogVehicles(findCatalog)) as CatalogFeedVehicle[];
    return csvResponse(buildCatalogCsv(vehicles, site.url), true);
  } catch (error) {
    console.error("[meta catalog csv]", error);
    return csvResponse(buildCatalogCsv([], site.url), false);
  }
}
