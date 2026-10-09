import { VEHICLE_PHOTOS_BUCKET, VEHICLE_DOCS_BUCKET, parseStoredFileRef, storagePathFromPublicUrl } from "@/lib/storage-file-ref";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { zoomObjectPath } from "./photo-zoom-path";
import { galleryPreviewObjectPath } from "./gallery-preview-path";

/**
 * Cliente privilegiado só para o servidor (upload/delete no Storage).
 * Exige service role. A chave pública nunca autoriza alterações internas.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceKey;

  if (!url || !key) {
    throw new Error("Supabase env vars are not configured");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sem service role o Storage (RLS) costuma bloquear o upload das fotos. */
export function hasSupabaseServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export { VEHICLE_PHOTOS_BUCKET, VEHICLE_DOCS_BUCKET, PRIVATE_FILE_PREFIX, parseStoredFileRef, storagePathFromPublicUrl, privateFileRef, isInternalAdminFileUrl, adminFileViewHref, type StoredFileRef } from "@/lib/storage-file-ref";

export async function ensurePrivateDocsBucket() {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();
  if (listError) {
    console.error("[storage] listBuckets:", listError);
  }
  if (buckets?.some((bucket) => bucket.name === VEHICLE_DOCS_BUCKET)) {
    return;
  }

  const { error } = await supabase.storage.createBucket(VEHICLE_DOCS_BUCKET, {
    public: false,
    fileSizeLimit: 12 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  });
  if (error && !/already exists|duplicate|exists/i.test(error.message)) {
    console.error("[storage] createBucket documentos:", error);
    throw new Error(
      "Não foi possível criar o bucket privado `documentos`. Crie no painel do Supabase (Storage → New bucket, público desligado).",
    );
  }
}

export async function deleteStorageFiles(
  urls: Array<string | null | undefined>,
) {
  const grouped = new Map<string, string[]>();

  for (const value of urls) {
    const parsed = parseStoredFileRef(value);
    if (!parsed) continue;
    const list = grouped.get(parsed.bucket) ?? [];
    list.push(parsed.path);
    if (parsed.kind === "public") {
      const zoom = zoomObjectPath(parsed.path);
      if (zoom) list.push(zoom);
      const preview = galleryPreviewObjectPath(parsed.path);
      if (preview) list.push(preview);
    }
    grouped.set(parsed.bucket, list);
  }

  if (grouped.size === 0) return;

  try {
    const supabase = getSupabaseAdmin();
    for (const [bucket, paths] of Array.from(grouped.entries())) {
      const unique = Array.from(new Set(paths));
      const { error } = await supabase.storage.from(bucket).remove(unique);
      if (error) console.error("[storage] falha ao remover arquivos:", error);
    }
  } catch (error) {
    console.error("[storage] falha ao remover arquivos:", error);
  }
}

/**
 * Copia um objeto público do bucket de fotos para um path novo.
 * Devolve a URL pública do destino, ou null se a origem não for do Storage
 * ou se a cópia falhar (aí o chamador reutiliza a URL original).
 */
export async function copyPublicStorageObject(
  sourceUrl: string,
  destPath: string,
): Promise<string | null> {
  const sourcePath = storagePathFromPublicUrl(sourceUrl);
  if (!sourcePath || !destPath || destPath.includes("..")) return null;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .copy(sourcePath, destPath);
    if (error) {
      console.error("[storage] falha ao copiar objeto:", error);
      return null;
    }
    const { data } = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(destPath);
    return data.publicUrl;
  } catch (error) {
    console.error("[storage] falha ao copiar objeto:", error);
    return null;
  }
}

/** @deprecated Use deleteStorageFiles — aceita refs privadas e URLs públicas. */
export const deleteStoragePublicUrls = deleteStorageFiles;
