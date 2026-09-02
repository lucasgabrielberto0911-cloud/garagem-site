"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { storeCardThumbnail } from "@/lib/photo-thumbnails";
import { prisma } from "@/lib/prisma";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  storagePathFromPublicUrl,
} from "@/lib/supabase";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";

export type CleanupResult = {
  ok: boolean;
  message: string;
  removed?: number;
  checked?: number;
  remaining?: number;
};

const BACKFILL_BATCH = 20;

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
    const photos = await prisma.photo.findMany({
      select: { url: true, thumbnailUrl: true },
    }).catch(async (error) => {
      console.warn("[storage] cleanup: thumbnailUrl ainda não existe.", error);
      const legacy = await prisma.photo.findMany({ select: { url: true } });
      return legacy.map((photo) => ({ ...photo, thumbnailUrl: null as string | null }));
    });
    let extraUrls: Array<string | null | undefined> = [];
    try {
      const [costs, documents] = await Promise.all([
        prisma.vehicleCost.findMany({ select: { receiptUrl: true } }),
        prisma.vehicleDocument.findMany({ select: { fileUrl: true } }),
      ]);
      extraUrls = [
        ...costs.map((cost) => cost.receiptUrl),
        ...documents.map((doc) => doc.fileUrl),
      ];
    } catch (error) {
      console.warn("[storage] cleanup: tabelas de operação ainda não existem.", error);
    }
    const referenced = new Set(
      [
        ...photos.flatMap((photo) => [photo.url, photo.thumbnailUrl]),
        ...extraUrls,
      ]
        .map((url) => (url ? storagePathFromPublicUrl(url) : null))
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
        // Pasta de comprovantes/documentos — não entra na limpeza de fotos.
        if (item.name === "docs") continue;
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

/**
 * Gera capas 480×300 para fotos antigas sem thumbnailUrl.
 * Lote pequeno para caber no tempo da função na Vercel — clique de novo se ainda faltar.
 */
export async function backfillMissingThumbnails(): Promise<CleanupResult> {
  await requireAdmin();

  if (!hasSupabaseServiceRole()) {
    return {
      ok: false,
      message:
        "Configure SUPABASE_SERVICE_ROLE_KEY para gerar miniaturas no Storage.",
    };
  }

  try {
    const missing = await prisma.photo.findMany({
      where: { OR: [{ thumbnailUrl: null }, { thumbnailUrl: "" }] },
      orderBy: { order: "asc" },
      take: BACKFILL_BATCH,
      select: { id: true, url: true },
    });

    if (missing.length === 0) {
      return {
        ok: true,
        message: "Todas as fotos do estoque já têm miniatura.",
        removed: 0,
        remaining: 0,
      };
    }

    let done = 0;
    let skipped = 0;

    for (const photo of missing) {
      const result = await storeCardThumbnail(photo.url);
      if (!result.ok) {
        skipped += 1;
        console.warn(`[thumbs] foto ${photo.id}: ${result.error}`);
        continue;
      }
      await prisma.photo.update({
        where: { id: photo.id },
        data: { thumbnailUrl: result.thumbnailUrl },
      });
      done += 1;
    }

    const remaining = await prisma.photo.count({
      where: { OR: [{ thumbnailUrl: null }, { thumbnailUrl: "" }] },
    });

    revalidateTag(VEHICLES_PUBLIC_CACHE_TAG, "max");
    revalidatePath("/");
    revalidatePath("/estoque");
    revalidatePath("/estoque/[id]", "page");
    revalidatePath("/admin/site");

    const extra =
      remaining > 0
        ? ` Ainda faltam ${remaining} — clique de novo.`
        : " Estoque completo.";

    return {
      ok: done > 0 || skipped === 0,
      message: `Geradas ${done} miniatura(s)${skipped ? `, ${skipped} ignorada(s)` : ""}.${extra}`,
      removed: done,
      remaining,
    };
  } catch (error) {
    console.error("[thumbs] backfill:", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar as miniaturas.",
    };
  }
}
