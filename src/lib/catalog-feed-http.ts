import { NextResponse } from "next/server";
import {
  buildCatalogCsv,
  includeConsignedInFeed,
  type CatalogFeedVehicle,
} from "@/lib/catalog-feed";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { site } from "@/lib/site";

/**
 * CDN só. Sem `revalidate` / `revalidatePath`: o feed não entra no ISR
 * (cada gravação de estoque já reescreve home, listagem e a ficha).
 */
export const CATALOG_CACHE_CONTROL =
  "public, s-maxage=900, stale-while-revalidate=86400";

const PHOTO_SELECT = {
  orderBy: { order: "asc" as const },
  take: 8,
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
  photos: PHOTO_SELECT,
} as const;

type CatalogWhere = {
  status: "disponivel";
  historical?: false;
  consigned?: false;
};

async function findCatalog(where: CatalogWhere, legacy: boolean) {
  return prisma.vehicle.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 400,
    select: legacy ? CATALOG_SELECT_LEGACY : CATALOG_SELECT,
  });
}

async function loadCatalogVehicles(includeConsigned: boolean) {
  const where: CatalogWhere = {
    status: "disponivel",
    historical: false,
    ...(includeConsigned ? {} : { consigned: false }),
  };

  try {
    return await findCatalog(where, false);
  } catch (error) {
    if (isMissingColumnError(error, "locationCity")) {
      try {
        return await findCatalog(where, true);
      } catch (inner) {
        if (!isMissingColumnError(inner, "consigned") || includeConsigned) throw inner;
        const { consigned: _drop, ...rest } = where;
        return findCatalog(rest, true);
      }
    }
    if (isMissingColumnError(error, "consigned") && !includeConsigned) {
      const { consigned: _drop, ...rest } = where;
      return loadWithoutConsigned(rest);
    }
    if (!isMissingColumnError(error, "historical")) throw error;
    const { historical: _drop, ...rest } = where;
    return loadWithoutHistorical(rest);
  }
}

async function loadWithoutHistorical(where: CatalogWhere) {
  try {
    return await findCatalog(where, false);
  } catch (error) {
    if (isMissingColumnError(error, "locationCity")) {
      return findCatalog(where, true);
    }
    if (isMissingColumnError(error, "consigned") && where.consigned === false) {
      const { consigned: _drop, ...rest } = where;
      return findCatalog(rest, false);
    }
    throw error;
  }
}

async function loadWithoutConsigned(where: CatalogWhere) {
  try {
    return await findCatalog(where, false);
  } catch (error) {
    if (!isMissingColumnError(error, "historical")) throw error;
    const { historical: _drop, ...rest } = where;
    try {
      return await findCatalog(rest, false);
    } catch (inner) {
      if (!isMissingColumnError(inner, "locationCity")) throw inner;
      return findCatalog(rest, true);
    }
  }
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

export async function catalogCsvResponse(request: Request) {
  const includeConsigned = includeConsignedInFeed(
    new URL(request.url).searchParams.get("consigned"),
  );
  try {
    const vehicles = (await loadCatalogVehicles(includeConsigned)) as CatalogFeedVehicle[];
    return csvResponse(buildCatalogCsv(vehicles, site.url), true);
  } catch (error) {
    console.error("[meta catalog csv]", error);
    return csvResponse(buildCatalogCsv([], site.url), false);
  }
}
