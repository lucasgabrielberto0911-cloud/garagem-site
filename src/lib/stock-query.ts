/** Tipos e parsers do estoque — seguro para o bundle do cliente. */

/** 8 no celular = 4 linhas; lotes menores descem mais rápido na rolagem. */
export const STOCK_PAGE_SIZE = 8;

export type VehicleCardPhoto = { url: string; thumbnailUrl?: string | null };

export type VehicleCardRecord = {
  id: string;
  category?: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  km: number;
  price: number;
  transmission: string;
  fuel: string;
  status: string;
  featured: boolean;
  photos: VehicleCardPhoto[];
};

const SUPABASE_OBJECT_PUBLIC = "/storage/v1/object/public/";
const SUPABASE_RENDER_PUBLIC = "/storage/v1/render/image/public/";

/** Mesmas medidas do card WebP gerado no upload (image-variants). */
const CARD_RENDER_WIDTH = 480;
const CARD_RENDER_HEIGHT = 300;
const CARD_RENDER_2X_WIDTH = 720;
const CARD_RENDER_2X_HEIGHT = 450;
const GALLERY_PREVIEW_WIDTH = 960;
const GALLERY_PREVIEW_HEIGHT = 600;
const GALLERY_THUMB_WIDTH = 240;
const GALLERY_THUMB_HEIGHT = 150;

type TransformResize = "cover" | "contain";

/**
 * Recorte leve via Image Transformations do Storage.
 * Sem thumbnailUrl no banco, o card baixava o original (~100–200 KB).
 */
export function supabaseTransformSrc(
  url: string,
  width: number,
  height: number,
  resize: TransformResize = "cover",
  quality = "65",
) {
  if (!url.includes(SUPABASE_OBJECT_PUBLIC) || url.includes(SUPABASE_RENDER_PUBLIC)) {
    return url;
  }
  const hashIndex = url.indexOf("#");
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const path = withoutHash.split("?")[0];
  const render = path.replace(SUPABASE_OBJECT_PUBLIC, SUPABASE_RENDER_PUBLIC);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    resize,
    quality,
  });
  return `${render}?${params.toString()}${hash}`;
}

export function supabaseCardSrc(
  url: string,
  width = CARD_RENDER_WIDTH,
  height = CARD_RENDER_HEIGHT,
) {
  return supabaseTransformSrc(url, width, height, "cover");
}

/** Se o recorte falhar, o <img> volta ao arquivo original. */
export function supabaseOriginalSrc(url: string) {
  if (!url.includes(SUPABASE_RENDER_PUBLIC)) return url;
  return url.split("?")[0].replace(SUPABASE_RENDER_PUBLIC, SUPABASE_OBJECT_PUBLIC);
}

export function coverSrc(photos: VehicleCardPhoto[] | undefined) {
  const photo = photos?.[0];
  if (!photo) return undefined;
  if (photo.thumbnailUrl) return photo.thumbnailUrl;
  return photo.url ? supabaseCardSrc(photo.url) : undefined;
}

export function coverSrcSet(photos: VehicleCardPhoto[] | undefined) {
  const photo = photos?.[0];
  if (!photo?.url || photo.thumbnailUrl) return undefined;
  if (!photo.url.includes(SUPABASE_OBJECT_PUBLIC)) return undefined;
  const small = supabaseCardSrc(photo.url, CARD_RENDER_WIDTH, CARD_RENDER_HEIGHT);
  const large = supabaseCardSrc(photo.url, CARD_RENDER_2X_WIDTH, CARD_RENDER_2X_HEIGHT);
  return `${small} ${CARD_RENDER_WIDTH}w, ${large} ${CARD_RENDER_2X_WIDTH}w`;
}

/** Foto da galeria do anúncio: miniatura no strip, preview no slide, original no zoom. */
export type GalleryPhoto = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
};

export function galleryThumbSrc(photo: GalleryPhoto) {
  if (photo.thumbnailUrl) return photo.thumbnailUrl;
  return photo.url
    ? supabaseTransformSrc(photo.url, GALLERY_THUMB_WIDTH, GALLERY_THUMB_HEIGHT)
    : photo.url;
}

/** Slide da ficha (~100vw no celular): recorte 960×600, não o original. */
export function galleryPreviewSrc(photo: GalleryPhoto) {
  return photo.url
    ? supabaseTransformSrc(
        photo.url,
        GALLERY_PREVIEW_WIDTH,
        GALLERY_PREVIEW_HEIGHT,
        "cover",
        "70",
      )
    : photo.url;
}

export function galleryPreviewSrcSet(photo: GalleryPhoto) {
  if (!photo.url?.includes(SUPABASE_OBJECT_PUBLIC)) return undefined;
  const small = supabaseTransformSrc(photo.url, 640, 400, "cover", "70");
  const large = galleryPreviewSrc(photo);
  return `${small} 640w, ${large} 960w`;
}

export type StockFilters = {
  q?: string;
  category?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  accessories?: string[];
  hasInspection?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  maxKm?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type StockPageResult = {
  vehicles: VehicleCardRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
};

function optionalPositiveNumber(value?: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function pickParam(
  input: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

function pickParamList(
  input: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = input[key];
  const parts = Array.isArray(value) ? value : value ? [value] : [];
  const items: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    for (const item of part.split(",")) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const keyName = trimmed.toLocaleLowerCase("pt-BR");
      if (seen.has(keyName)) continue;
      seen.add(keyName);
      items.push(trimmed.slice(0, 80));
    }
  }
  return items.slice(0, 12);
}

function truthyFlag(value?: string) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "sim";
}

/** Interpreta query string do estoque (página, API e rolagem infinita). */
export function parseStockFilters(
  input: Record<string, string | string[] | undefined>,
  options?: { page?: number },
): StockFilters {
  return {
    q: pickParam(input, "q"),
    category: pickParam(input, "category"),
    brand: pickParam(input, "brand"),
    transmission: pickParam(input, "transmission"),
    fuel: pickParam(input, "fuel"),
    color: pickParam(input, "color"),
    accessories: pickParamList(input, "accessory"),
    hasInspection: truthyFlag(pickParam(input, "laudo")),
    minPrice: optionalPositiveNumber(pickParam(input, "minPrice")),
    maxPrice: optionalPositiveNumber(pickParam(input, "maxPrice")),
    minYear: optionalPositiveNumber(pickParam(input, "minYear")),
    maxYear: optionalPositiveNumber(pickParam(input, "maxYear")),
    maxKm: optionalPositiveNumber(pickParam(input, "maxKm")),
    sort: pickParam(input, "sort"),
    page: options?.page ?? Math.max(1, Number(pickParam(input, "page")) || 1),
    pageSize: optionalPositiveNumber(pickParam(input, "pageSize")),
  };
}
