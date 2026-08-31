import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente privilegiado só para o servidor (upload/delete no Storage).
 * Prefere a service role; cai na anon key se ela ainda não estiver configurada,
 * para não quebrar ambientes antigos — mas o .env.example já pede a service role.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;

  if (!url || !key) {
    throw new Error("Supabase env vars are not configured");
  }

  if (!serviceKey && process.env.NODE_ENV === "production") {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY ausente — uploads usam a anon key.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sem service role o Storage (RLS) costuma bloquear o upload das fotos. */
export function hasSupabaseServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export const VEHICLE_PHOTOS_BUCKET = "veiculos";
export const VEHICLE_DOCS_BUCKET = "documentos";
export const PRIVATE_FILE_PREFIX = "private://documentos/";

export type StoredFileRef =
  | { kind: "private"; bucket: typeof VEHICLE_DOCS_BUCKET; path: string }
  | { kind: "public"; bucket: typeof VEHICLE_PHOTOS_BUCKET; path: string; url: string };

function publicMarker(bucket: string) {
  return `/storage/v1/object/public/${bucket}/`;
}

/** Extrai o path do objeto a partir da URL pública do Storage. */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = publicMarker(VEHICLE_PHOTOS_BUCKET);
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export function parseStoredFileRef(value: string | null | undefined): StoredFileRef | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith(PRIVATE_FILE_PREFIX)) {
    const path = raw.slice(PRIVATE_FILE_PREFIX.length).replace(/^\/+/, "");
    if (!path || path.includes("..")) return null;
    return { kind: "private", bucket: VEHICLE_DOCS_BUCKET, path };
  }

  const path = storagePathFromPublicUrl(raw);
  if (!path) return null;
  return { kind: "public", bucket: VEHICLE_PHOTOS_BUCKET, path, url: raw };
}

export function privateFileRef(path: string) {
  return `${PRIVATE_FILE_PREFIX}${path.replace(/^\/+/, "")}`;
}

export function isInternalAdminFileUrl(url: string) {
  return parseStoredFileRef(url) != null;
}

export function adminFileViewHref(stored: string) {
  return `/api/admin/files/view?ref=${encodeURIComponent(stored)}`;
}

export async function ensurePrivateDocsBucket() {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
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

export async function deleteStorageFiles(urls: Array<string | null | undefined>) {
  const grouped = new Map<string, string[]>();

  for (const value of urls) {
    const parsed = parseStoredFileRef(value);
    if (!parsed) continue;
    const list = grouped.get(parsed.bucket) ?? [];
    list.push(parsed.path);
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
