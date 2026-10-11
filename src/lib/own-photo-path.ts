import { VEHICLE_PHOTOS_BUCKET } from "@/lib/storage-file-ref";

/**
 * Caminho no bucket `veiculos` de uma URL pública do nosso Storage, sem query
 * nem hash. Qualquer outro host, protocolo ou prefixo devolve null.
 */
export function ownPublicPhotoPath(value: unknown, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const base = new URL(supabaseUrl ?? "");
    const prefix = `/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/`;
    if (url.protocol !== "https:" || url.origin !== base.origin || url.search || url.hash || !url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch { return null; }
}
