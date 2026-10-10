"use server";

import { withAdminStorageLock } from "@/lib/admin-storage-lock";
import { revalidatePath } from "next/cache";
import { revalidateAllPublicFichas } from "@/lib/public-stock-revalidate";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PHOTO_MASTER_PREFIX } from "@/lib/photo-master";
import { adminFileReferences } from "@/lib/admin-file-references";
import { isCleanupCandidate } from "@/lib/admin-cleanup";
import { storeCardThumbnail } from "@/lib/photo-thumbnails";
import { prisma } from "@/lib/prisma";
import {
  VEHICLE_PHOTOS_BUCKET,
  VEHICLE_DOCS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
} from "@/lib/supabase";

export type CleanupResult = {
  ok: boolean;
  message: string;
  removed?: number;
  checked?: number;
  remaining?: number;
  candidates?: string[];
};

const BACKFILL_BATCH = 20;

async function requireAdmin() {
  const session = await getSession();
  if (!session?.adminId) redirect("/admin/login");
  return session;
}

/**
 * Confere vínculos de todas as áreas e prepara prévia antes da remoção.
 */
export async function cleanupOrphanPhotos(
  confirmed?: string[],
): Promise<CleanupResult> {
  await requireAdmin();

  if (!hasSupabaseServiceRole()) {
    return {
      ok: false,
      message:
        "Configure SUPABASE_SERVICE_ROLE_KEY para limpar fotos no Storage.",
    };
  }

  try {
    return await withAdminStorageLock(async (tx) => {
      const supabase = getSupabaseAdmin();
      const { publicPaths, privatePaths } = await adminFileReferences(tx);
      const orphans: string[] = [];
      let offset = 0;
      const limit = 100;
      let checked = 0;

      for (let page = 0; page < 50; page += 1) {
        const { data, error } = await supabase.storage
          .from(VEHICLE_PHOTOS_BUCKET)
          .list("", {
            limit,
            offset,
            sortBy: { column: "name", order: "asc" },
          });

        if (error) {
          return {
            ok: false,
            message: error.message || "Falha ao listar Storage.",
          };
        }
        if (!data || data.length === 0) break;

        for (const item of data) {
          if (!item.name || item.name.endsWith("/")) continue;
          // Pasta de comprovantes/documentos — não entra na limpeza de fotos.
          if (item.name === "docs") continue;
          // Ignora "pastas" sem id/metadata de arquivo.
          if (item.id === null && !item.metadata) continue;
          checked += 1;
          if (isCleanupCandidate(item, publicPaths)) {
            orphans.push(`${VEHICLE_PHOTOS_BUCKET}/${item.name}`);
          }
        }

        if (data.length < limit) break;
        offset += limit;
      }

      // Masters privados recebem a mesma prévia e proteção, mesmo sem galeria órfã.
      for (let page = 0; page < 50; page += 1) {
        const { data, error } = await supabase.storage
          .from(VEHICLE_DOCS_BUCKET)
          .list(PHOTO_MASTER_PREFIX.replace(/\/$/, ""), {
            limit,
            offset: page * limit,
            sortBy: { column: "name", order: "asc" },
          });
        if (error)
          return {
            ok: false,
            message:
              "Não foi possível conferir os originais privados. Nenhum arquivo foi removido.",
          };
        if (!data?.length) break;
        for (const item of data) {
          if (
            !item.name ||
            !/\.jpg$/i.test(item.name) ||
            (item.id === null && !item.metadata)
          )
            continue;
          checked++;
          const path = `${PHOTO_MASTER_PREFIX}${item.name}`;
          if (isCleanupCandidate({ ...item, name: path }, privatePaths))
            orphans.push(`${VEHICLE_DOCS_BUCKET}/${path}`);
        }
        if (data.length < limit) break;
      }

      // Fotos do formulário Vender que ninguém anexou a um pedido (a pessoa
      // desistiu antes de enviar). Mesma regra: 48 horas e sem vínculo.
      for (let page = 0; page < 50; page += 1) {
        const { data, error } = await supabase.storage
          .from(VEHICLE_DOCS_BUCKET)
          .list("vender", {
            limit,
            offset: page * limit,
            sortBy: { column: "name", order: "asc" },
          });
        if (error)
          return {
            ok: false,
            message:
              "Não foi possível conferir as fotos do formulário Vender. Nenhum arquivo foi removido.",
          };
        if (!data?.length) break;
        for (const item of data) {
          if (!item.name || (item.id === null && !item.metadata)) continue;
          checked++;
          const path = `vender/${item.name}`;
          if (isCleanupCandidate({ ...item, name: path }, privatePaths))
            orphans.push(`${VEHICLE_DOCS_BUCKET}/${path}`);
        }
        if (data.length < limit) break;
      }

      if (!confirmed)
        return {
          ok: true,
          message: `${orphans.length} arquivo(s) antigos sem vínculo. Fotos enviadas nas últimas 48 horas ficam protegidas.`,
          checked,
          candidates: orphans,
        };
      // Aceita apenas itens da prévia que continuam candidatos após reler todas as referências.
      const approved = new Set(confirmed.slice(0, 5000));
      const eligible = orphans.filter((path) => approved.has(path));

      if (eligible.length === 0) {
        return {
          ok: true,
          message: `Nenhum arquivo aprovado continua sem vínculo. ${checked} arquivo(s) conferido(s).`,
          removed: 0,
          checked,
        };
      }

      let removed = 0;
      for (const bucket of [VEHICLE_PHOTOS_BUCKET, VEHICLE_DOCS_BUCKET]) {
        const paths = eligible
          .filter((path) => path.startsWith(`${bucket}/`))
          .map((path) => path.slice(bucket.length + 1));
        for (let index = 0; index < paths.length; index += 50) {
          const batch = paths.slice(index, index + 50);
          const { error } = await supabase.storage.from(bucket).remove(batch);
          if (error)
            return {
              ok: false,
              message: `Limpeza interrompida: ${removed} arquivo(s) removido(s). Tente uma nova prévia.`,
              removed,
              checked,
            };
          removed += batch.length;
        }
      }

      revalidatePath("/admin/veiculos");
      revalidatePath("/admin/site");

      return {
        ok: true,
        message: `Removidos ${removed} arquivo(s) antigos sem vínculo de ${checked} conferidos.`,
        removed,
        checked,
      };
    });
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

    revalidateAllPublicFichas();
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
