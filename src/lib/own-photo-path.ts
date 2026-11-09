import { VEHICLE_PHOTOS_BUCKET } from "@/lib/storage-file-ref";
import { isR2StorageHost } from "@/lib/r2-photos";

/**
 * Caminho no bucket `veiculos` do Storage ou chave no bucket do Cloudflare R2
 * de uma URL pública do nosso acervo, sem query nem hash.
 * Qualquer outro host, protocolo ou prefixo devolve null.
 */
export function ownPublicPhotoPath(value: unknown, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.search || url.hash) return null;

    // Supabase
    if (supabaseUrl) {
      try {
        const base = new URL(supabaseUrl);
        const prefix = `/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/`;
        if (url.origin === base.origin && url.pathname.startsWith(prefix)) {
          const decoded = decodeURIComponent(url.pathname.slice(prefix.length));
          if (!decoded || decoded.includes("..") || decoded.includes("\\")) return null;
          return decoded;
        }
      } catch {}
    }

    // Cloudflare R2
    if (isR2StorageHost(url.hostname)) {
      const decoded = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (!decoded || decoded.includes("..") || decoded.includes("\\")) return null;
      return decoded;
    }

    return null;
  } catch { return null; }
}
