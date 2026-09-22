import { privateFileRef, storagePathFromPublicUrl } from "@/lib/supabase";
import { supabaseOriginalSrc } from "@/lib/stock-query";

/**
 * Alta qualidade do admin. O site público continua no JPEG 90 da galeria (≤1280).
 * 93 fica na faixa 92–95: detalhe para Marketplace, sem um segundo downscale.
 */
export const ADMIN_JPEG_QUALITY = 93;

/** Lado maior do master privado. Abaixo disso, guarda o tamanho original. */
export const MASTER_MAX_EDGE = 3840;

/** Bucket privado `documentos`. Nunca vira URL pública. */
export const PHOTO_MASTER_PREFIX = "foto-master/";

const MASTER_ID =
  /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPhotoMasterId(id: string) {
  return MASTER_ID.test(id);
}

export function createPhotoMasterId() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

/** Nome da galeria pública, sem pasta e sem a miniatura `-card`. */
export function galleryStemFromStoragePath(storagePath: string): string | null {
  if (!storagePath || storagePath.includes("..") || storagePath.includes("\\")) {
    return null;
  }
  const base = storagePath.split("/").pop() ?? "";
  if (!base || /-card\.webp$/i.test(base)) return null;
  const stem = base.replace(/\.[a-z0-9]{2,5}$/i, "");
  if (!stem || !/^[0-9a-z-]{8,80}$/i.test(stem)) return null;
  return stem;
}

/** Path no bucket privado, derivado da foto pública. Sem URL aberta. */
export function masterObjectPathFromGalleryPath(galleryPath: string): string | null {
  const stem = galleryStemFromStoragePath(galleryPath);
  if (!stem) return null;
  return `${PHOTO_MASTER_PREFIX}${stem}.jpg`;
}

export function masterObjectPathFromId(id: string): string | null {
  if (!isPhotoMasterId(id)) return null;
  return `${PHOTO_MASTER_PREFIX}${id}.jpg`;
}

export function privateMasterRefForPublicUrl(url: string | null | undefined) {
  if (!url) return null;
  const withoutHash = url.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";
  let galleryPath: string | null = null;
  try {
    galleryPath = storagePathFromPublicUrl(supabaseOriginalSrc(withoutQuery));
  } catch {
    return null;
  }
  if (!galleryPath) return null;
  const master = masterObjectPathFromGalleryPath(galleryPath);
  if (!master) return null;
  return privateFileRef(master);
}
