import {
  PHOTO_R2_ORIGIN,
  PHOTO_STORAGE_ORIGIN,
  isPublicPhotoBlob,
  publicPhotoR2Origin,
  validPublicPhotoKey,
} from "./public-photo-url";
import type { VehicleCardPhoto, VehicleCardRecord } from "./stock-query";

/**
 * Cache em memória e validação de URLs para LQIP.
 * Mantido separado de `photo-lqip.ts` para não puxar `sharp` para rotas
 * onde o binário é excluído no `next.config.mjs` (ex.: `/api/estoque`, `/api/veiculos`).
 */

export const MAX_LQIP_MEMORY_ENTRIES = 512;

const OBJECT_PUBLIC_PREFIX = "/storage/v1/object/public/veiculos/";
const LQIP_DATA_URI_PATTERN = /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/;

const memoryCache = new Map<string, string>();

/** Valida que a string é uma data URI WebP base64 segura para uso em CSS background-image. */
export function isValidLqipDataUri(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length <= 2048 && LQIP_DATA_URI_PATTERN.test(value);
}

/**
 * Só baixa miniatura de origens públicas da própria loja:
 * - R2 público da loja (`PHOTO_R2_ORIGIN` ou `R2_PUBLIC_URL` configurado)
 * - Blob público da loja (`PHOTO_BLOB_ORIGIN`)
 * - Storage público do bucket `veiculos` (`PHOTO_STORAGE_ORIGIN`)
 */
export function isAllowedLqipUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  if (value.includes("..") || value.includes("\\")) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password || url.search || url.hash || url.port) return false;

    const r2Origins = new Set([PHOTO_R2_ORIGIN, publicPhotoR2Origin()]);
    if (r2Origins.has(url.origin)) {
      const parts = url.pathname.replace(/^\/+/, "").split("/").map(decodeURIComponent);
      return validPublicPhotoKey(parts);
    }

    if (isPublicPhotoBlob(value)) return true;

    if (url.origin === PHOTO_STORAGE_ORIGIN && url.pathname.startsWith(OBJECT_PUBLIC_PREFIX)) {
      const parts = url.pathname.slice(OBJECT_PUBLIC_PREFIX.length).split("/").map(decodeURIComponent);
      return validPublicPhotoKey(parts);
    }

    return false;
  } catch {
    return false;
  }
}

/** Escolhe a URL da capa (prefere a miniatura 480×360 já gravada no upload). */
export function lqipSourceUrl(photos: readonly VehicleCardPhoto[] | undefined): string | null {
  const first = photos?.[0];
  if (!first) return null;
  const candidate = first.thumbnailUrl?.trim() || first.url?.trim() || "";
  return candidate || null;
}

export function getCachedPhotoLqip(url: string): string | undefined {
  const hit = memoryCache.get(url);
  if (!hit) return undefined;
  // Reinsere no fim para manter comportamento LRU simples.
  memoryCache.delete(url);
  memoryCache.set(url, hit);
  return hit;
}

export function setCachedPhotoLqip(url: string, dataUri: string): void {
  if (!isValidLqipDataUri(dataUri)) return;
  if (memoryCache.has(url)) {
    memoryCache.delete(url);
  } else if (memoryCache.size >= MAX_LQIP_MEMORY_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(url, dataUri);
}

export function clearPhotoLqipMemoryCacheForTests(): void {
  memoryCache.clear();
}

export function photoLqipMemoryCacheSizeForTests(): number {
  return memoryCache.size;
}

/**
 * Anexa LQIP apenas se já estiver aquecido em memória — sem rede e sem `sharp`.
 * Usado por rotas paginadas (`/api/estoque`, `/api/veiculos`).
 */
export function attachCachedPhotoLqip<T extends VehicleCardRecord>(vehicles: T[]): T[] {
  if (vehicles.length === 0) return vehicles;
  let changed = false;
  const next = vehicles.map((vehicle) => {
    const source = lqipSourceUrl(vehicle.photos);
    if (!source) return vehicle;
    const lqip = getCachedPhotoLqip(source);
    if (!lqip) return vehicle;
    changed = true;
    const [first, ...rest] = vehicle.photos;
    return {
      ...vehicle,
      photos: [{ ...first, lqip }, ...rest],
    };
  });
  return changed ? next : vehicles;
}
