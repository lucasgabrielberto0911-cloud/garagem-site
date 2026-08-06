"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

export type CleanupResult = {
  ok: boolean;
  message: string;
  removed?: number;
  checked?: number;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session?.adminId) redirect("/admin/login");
  return session;
}

/**
 * Remove do Storage arquivos que não estão referenciados em Photo.
 * Útil após edições que trocam/removem fotos sem apagar o blob.
 */
export async function cleanupOrphanPhotos(): Promise<CleanupResult> {
  await requireAdmin();

  if (!hasSupabaseServiceRole()) {
    return {
      ok: false,
      message:
        "Configure SUPABASE_SERVICE_ROLE_KEY para limpar fotos no Storage.",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const photos = await prisma.photo.findMany({ select: { url: true } });
    const referenced = new Set(
      photos
        .map((photo) => storagePathFromPublicUrl(photo.url))
        .filter((path): path is string => Boolean(path)),
    );

    const orphans: string[] = [];
    let offset = 0;
    const limit = 100;
    let checked = 0;

    for (let page = 0; page < 50; page += 1) {
      const { data, error } = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .list("", { limit, offset, sortBy: { column: "name", order: "asc" } });

      if (error) {
        return { ok: false, message: error.message || "Falha ao listar Storage." };
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        if (!item.name || item.name.endsWith("/")) continue;
        // Ignora "pastas" sem id/metadata de arquivo.
        if (item.id === null && !item.metadata) continue;
        checked += 1;
        if (!referenced.has(item.name)) {
          orphans.push(item.name);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }

    if (orphans.length === 0) {
      return {
        ok: true,
        message: `Nenhuma foto órfã. ${checked} arquivo(s) conferido(s).`,
        removed: 0,
        checked,
      };
    }

    let removed = 0;
    for (let index = 0; index < orphans.length; index += 50) {
      const batch = orphans.slice(index, index + 50);
      const { error } = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .remove(batch);
      if (error) {
        console.error("[storage] limpeza parcial:", error);
        return {
          ok: false,
          message: `Removidas ${removed} de ${orphans.length}. Erro: ${error.message}`,
          removed,
          checked,
        };
      }
      removed += batch.length;
    }

    revalidatePath("/admin/veiculos");
    revalidatePath("/admin/site");

    return {
      ok: true,
      message: `Removidas ${removed} foto(s) órfã(s) de ${checked} arquivo(s).`,
      removed,
      checked,
    };
  } catch (error) {
    console.error("[storage] cleanup:", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível limpar o Storage.",
    };
  }
}
