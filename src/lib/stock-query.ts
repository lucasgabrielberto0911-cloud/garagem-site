/** Tipos e parsers do estoque — seguro para o bundle do cliente. */

export const STOCK_PAGE_SIZE = 12;

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

export function coverSrc(photos: VehicleCardPhoto[] | undefined) {
  const photo = photos?.[0];
  return photo?.thumbnailUrl || photo?.url;
}

/** Foto da galeria do anúncio: miniatura no strip, original no slide ativo. */
export type GalleryPhoto = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
};

export function galleryThumbSrc(photo: GalleryPhoto) {
  return photo.thumbnailUrl || photo.url;
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
