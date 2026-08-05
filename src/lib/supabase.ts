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

export const VEHICLE_PHOTOS_BUCKET = "veiculos";

/** Extrai o path do objeto a partir da URL pública do Storage. */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}
