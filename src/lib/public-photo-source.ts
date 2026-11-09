import { isR2PhotoUrl, r2KeyFromUrl } from "./r2-photos";
import { isPublicPhotoBlob, validPublicPhotoKey } from "./public-photo-url";

/** Foto pública do R2: mesmas regras de forma do Blob (sem credenciais, query, hash ou porta). */
export function isPublicR2Photo(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.port) return false;
    if (!isR2PhotoUrl(url)) return false;
    const key = r2KeyFromUrl(url);
    return key !== null && validPublicPhotoKey(key.split("/"));
  } catch { return false; }
}

/** Origens públicas que o servidor pode buscar ou redirecionar: Blob da loja ou R2. */
export function isPublicPhotoSource(value: string) {
  return isPublicPhotoBlob(value) || isPublicR2Photo(value);
}
