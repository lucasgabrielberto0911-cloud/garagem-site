import { unstable_cache } from "next/cache";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";

/** Histórico público apenas: nunca vendas internas nem preço de vendido. */
export const getStockLandingHistory = cache(unstable_cache(async () => {
  return prisma.vehicle.findMany({
    where: { historical: false, status: { in: ["disponivel", "vendido"] } },
    select: { id: true, brand: true, model: true, version: true, yearModel: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
}, ["stock-landing-history-v1"], { revalidate: 600, tags: [VEHICLES_PUBLIC_CACHE_TAG] }));
