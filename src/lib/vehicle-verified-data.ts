import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isMissingTableError } from "@/lib/prisma-errors";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";
import {
  parseVerifiedItems,
  type VerifiedItem,
} from "@/lib/vehicle-verified";

/**
 * Lê os itens verificados de um veículo. Erro de banco propaga: o
 * `unstable_cache` não guarda exceção, então uma falha momentânea (ou a tabela
 * ainda sem o SQL) não fica presa em cache.
 */
const loadVerifiedCached = unstable_cache(
  async (vehicleId: string): Promise<VerifiedItem[]> => {
    const row = await prisma.vehicleVerifiedInfo.findUnique({
      where: { vehicleId },
      select: { items: true },
    });
    return row ? parseVerifiedItems(row.items) : [];
  },
  ["vehicle-verified-v1"],
  { revalidate: 600, tags: [VEHICLES_PUBLIC_CACHE_TAG] },
);

/**
 * Para a ficha pública. Qualquer falha (inclusive tabela ainda inexistente)
 * vira "sem informação": a ficha segue igual, só sem a seção.
 */
export const getVehicleVerifiedItems = cache(
  async (vehicleId: string): Promise<VerifiedItem[]> => {
    try {
      return await loadVerifiedCached(vehicleId);
    } catch (error) {
      if (isMissingTableError(error, "VehicleVerifiedInfo")) {
        console.warn(
          "[site] tabela VehicleVerifiedInfo ausente: rode prisma/sql/vehicle-verified-info.sql",
        );
      } else {
        console.error("[site] falha ao consultar informações verificadas:", error);
      }
      return [];
    }
  },
);

export type AdminVerifiedState =
  | { available: true; items: VerifiedItem[] }
  | { available: false; reason: "missing-table" | "error" };

/** Para o admin: sem cache, e avisa quando a tabela ainda não existe. */
export async function getAdminVerifiedState(
  vehicleId: string,
): Promise<AdminVerifiedState> {
  try {
    const row = await prisma.vehicleVerifiedInfo.findUnique({
      where: { vehicleId },
      select: { items: true },
    });
    return { available: true, items: row ? parseVerifiedItems(row.items) : [] };
  } catch (error) {
    if (isMissingTableError(error, "VehicleVerifiedInfo")) {
      return { available: false, reason: "missing-table" };
    }
    console.error("[admin] falha ao ler informações verificadas:", error);
    return { available: false, reason: "error" };
  }
}
