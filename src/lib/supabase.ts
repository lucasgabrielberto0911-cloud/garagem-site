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

/** Extrai o path do objeto a partir da URL pública do Storage. */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export function isInternalAdminFileUrl(url: string) {
  return storagePathFromPublicUrl(url) != null;
}

/** Remove blobs do bucket a partir das URLs públicas (fotos, comprovantes, docs). */
export async function deleteStoragePublicUrls(urls: Array<string | null | undefined>) {
  const paths = urls
    .map((url) => (url ? storagePathFromPublicUrl(url) : null))
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .remove(paths);
    if (error) console.error("[storage] falha ao remover arquivos:", error);
  } catch (error) {
    console.error("[storage] falha ao remover arquivos:", error);
  }
}
