import { revalidatePath, revalidateTag } from "next/cache";
import { expireAdminData } from "@/lib/admin-revalidate";
import { prisma } from "@/lib/prisma";
import { vehiclePath, type VehiclePathInput } from "@/lib/vehicle-slug";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";

const SLUG_SELECT = {
  id: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
} as const;

function revalidateSharedPublicStock(expireAdmin = true) {
  if (expireAdmin) expireAdminData();
  revalidateTag(VEHICLES_PUBLIC_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/estoque");
  revalidatePath("/sitemap.xml");
  revalidatePath("/catalog/meta.csv");
}

function revalidateSlug(vehicle: VehiclePathInput, seen: Set<string>) {
  const path = vehiclePath(vehicle);
  if (seen.has(path)) return;
  seen.add(path);
  revalidatePath(path);
}

/**
 * Uma unidade (criar, editar, status, venda): tag pública, home, listagem,
 * sitemap, feed da Meta e só o slug canônico daquela ficha.
 * Não chama `revalidatePath("/estoque/[id]", "page")` — isso regrava todas as fichas.
 * `previous` cobre a URL antiga quando marca/modelo/ano mudam o slug.
 */
export async function revalidatePublicStock(
  vehicle?: VehiclePathInput | string | null,
  previous?: VehiclePathInput | null,
) {
  revalidateSharedPublicStock();
  const seen = new Set<string>();
  if (previous?.id) revalidateSlug(previous, seen);

  if (!vehicle) return;
  if (typeof vehicle !== "string") {
    revalidateSlug(vehicle, seen);
    return;
  }

  const row = await prisma.vehicle.findUnique({
    where: { id: vehicle },
    select: SLUG_SELECT,
  });
  if (row) revalidateSlug(row, seen);
}

/** Vários ids conhecidos (status em lote): cada slug, sem derrubar as outras fichas. */
export async function revalidatePublicStockMany(ids: string[]) {
  revalidateSharedPublicStock();
  if (ids.length === 0) return;
  const rows = await prisma.vehicle.findMany({
    where: { id: { in: ids } },
    select: SLUG_SELECT,
  });
  const seen = new Set<string>();
  for (const row of rows) revalidateSlug(row, seen);
}

/**
 * Limpeza que altera o HTML de muitas fichas sem uma lista fechada de slugs
 * (miniaturas em lote). Aí a invalidação de página é necessária: slug a slug
 * não alcança fichas que o lote não enumerou.
 */
export function revalidateAllPublicFichas() {
  revalidateSharedPublicStock(false);
  revalidatePath("/estoque/[id]", "page");
}
