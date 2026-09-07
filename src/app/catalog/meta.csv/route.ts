import { NextResponse } from "next/server";
import { buildCatalogCsv } from "@/lib/catalog-feed";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { site } from "@/lib/site";

export const revalidate = 300;

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
  photos: {
    orderBy: { order: "asc" as const },
    take: 8,
    select: { url: true },
  },
} as const;

async function loadCatalogVehicles() {
  try {
    return await prisma.vehicle.findMany({
      where: { status: "disponivel", historical: false },
      orderBy: { updatedAt: "desc" },
      take: 400,
      select: CATALOG_SELECT,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "historical")) throw error;
    return prisma.vehicle.findMany({
      where: { status: "disponivel" },
      orderBy: { updatedAt: "desc" },
      take: 400,
      select: CATALOG_SELECT,
    });
  }
}

export async function GET() {
  try {
    const vehicles = await loadCatalogVehicles();
    const csv = buildCatalogCsv(vehicles, site.url);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        "Content-Disposition": 'inline; filename="garagem-estoque-meta.csv"',
      },
    });
  } catch (error) {
    console.error("[catalog/meta.csv]", error);
    return new NextResponse("vehicle_id\n", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
