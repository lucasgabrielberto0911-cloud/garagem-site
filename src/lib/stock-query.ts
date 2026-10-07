import { parseVehicleLocationCity } from "@/lib/vehicle-location";
import { publicPhotoOriginal } from "@/lib/public-photo-url";

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
  color?: string | null;
  locationCity?: string | null;
  updatedAt?: Date | string | null;
  photos: VehicleCardPhoto[];
};

/**
 * LCP da ficha. O container é max-w-7xl com px-8; a coluna da foto é
 * 1.35 / 2.25 do miolo (menos o gap-8). No xl isso dá 710px, não 60vw
 * de um monitor largo. A foto continua full-bleed no celular; o slot
 * abaixo de 640px é 60vw para o DPR 3 cair no WebP 800 já existente,
 * e não no arquivo 1280.
 */
export const GALLERY_HERO_SIZES =
  "(min-width: 1280px) 710px, (min-width: 1024px) calc((100vw - 96px) * 0.6), (min-width: 640px) 100vw, 60vw";

/**
 * Card dentro do mesmo container: 2 colunas, 3 no lg, 4 no xl da home.
 * No estoque o lg tem sidebar, então o card é menor — esta medida é o
 * teto da home, para o celular não pedir a foto do desktop.
 * A coluna no celular tem ~173px. O slot corresponde à largura real;
 * o <picture> limita a capa móvel a 480px para evitar arquivos de desktop.
 */
export const CARD_SIZES =
  "(min-width: 1280px) 292px, (min-width: 1024px) calc((100vw - 96px) / 3), (min-width: 640px) calc((100vw - 64px) / 2), calc((100vw - 44px) / 2)";

const SUPABASE_OBJECT_PUBLIC = "/storage/v1/object/public/";
const SUPABASE_RENDER_PUBLIC = "/storage/v1/render/image/public/";

/** Mesmas medidas do card WebP gerado no upload (image-variants). */
const CARD_RENDER_WIDTH = 480;
const CARD_RENDER_HEIGHT = 360;
/** Retina no desktop; o celular usa a capa 4:3 limitada a 480px. */
const CARD_SHARP_WIDTHS = [720, 960] as const;
/** WebP 75: nítido em cima do arquivo da galeria, sem o peso do q80. */
const CARD_SHARP_QUALITY = "75";
const GALLERY_THUMB_WIDTH = 240;
const GALLERY_THUMB_HEIGHT = 150;
/**
 * Lado maior gravado no upload (image-variants GALLERY_MAX_EDGE).
 * Fica aqui para o bundle do cliente não importar o sharp.
 */
export const GALLERY_FILE_WIDTH = 1280;
/** Celular 2x e desktop 1x da ficha cabem aqui; o 1280 fica para o resto. */
const HERO_NARROW_WIDTH = 800;
const HERO_NARROW_QUALITY = "80";
/** JPG/PNG antigo: teto público. O WebP da galeria não é reencodado. */
const HERO_CAP_WIDTH = 1200;
const HERO_CAP_QUALITY = "80";

type TransformResize = "cover" | "contain";

function cardFrameHeight(width: number) {
  return Math.round((width * CARD_RENDER_HEIGHT) / CARD_RENDER_WIDTH);
}

function canTransform(url: string) {
  return url.includes(SUPABASE_OBJECT_PUBLIC) && !url.includes(SUPABASE_RENDER_PUBLIC);
}

function isCardDerivative(url: string) {
  return /-card\.webp(?:[?#]|$)/i.test(url);
}

/** WebP já limitado no upload. Reencodar só amacia e não ganha detalhe. */
function isOptimizedGalleryWebp(url: string) {
  return /\.webp(?:[?#]|$)/i.test(url) && !isCardDerivative(url);
}

/**
 * Recorte leve via Image Transformations do Storage.
 * `format=webp`: sem isso o render devolve JPEG, mais pesado e menos nítido.
 * Sem thumbnailUrl no banco, o card baixava o original (~100–200 KB).
 */
export function supabaseTransformSrc(
  url: string,
  width: number,
  height?: number,
  resize: TransformResize = "cover",
  quality = "65",
) {
  if (!canTransform(url)) return url;
  const hashIndex = url.indexOf("#");
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const path = withoutHash.split("?")[0];
  const render = path.replace(SUPABASE_OBJECT_PUBLIC, SUPABASE_RENDER_PUBLIC);
  const params = new URLSearchParams();
  params.set("width", String(width));
  if (height != null && height > 0) params.set("height", String(height));
  params.set("resize", resize);
  params.set("quality", quality);
  params.set("format", "webp");
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
  const ownOriginal = publicPhotoOriginal(url);
  if (ownOriginal) return ownOriginal;
  if (!url.includes(SUPABASE_RENDER_PUBLIC)) return url;
  return url.split("?")[0].replace(SUPABASE_RENDER_PUBLIC, SUPABASE_OBJECT_PUBLIC);
}

export function coverSrc(photos: VehicleCardPhoto[] | undefined) {
  const photo = photos?.[0];
  if (!photo) return undefined;
  if (photo.thumbnailUrl) return photo.thumbnailUrl;
  return photo.url ? supabaseCardSrc(photo.url) : undefined;
}

/**
 * A miniatura antiga é 8:5: recortá-la de novo no card 4:3 perde enquadramento
 * e pixels úteis. Deriva direto da galeria, sem trocar arquivos do acervo.
 * Um único tamanho móvel evita baixar a versão 720/960 numa tela 3x.
 */
export function coverMobileSrcSet(photos: VehicleCardPhoto[] | undefined) {
  const photo = photos?.[0];
  if (!photo?.url || !canTransform(photo.url) || isCardDerivative(photo.url)) return undefined;
  return `${supabaseTransformSrc(photo.url, CARD_RENDER_WIDTH, CARD_RENDER_HEIGHT, "cover", "74")} ${CARD_RENDER_WIDTH}w`;
}

/**
 * 480 da miniatura; 720 e 960 WebP para slots maiores do desktop/tablet.
 * A miniatura sozinha esticava no 3x e no desktop.
 */
export function coverSrcSet(photos: VehicleCardPhoto[] | undefined) {
  const photo = photos?.[0];
  if (!photo?.url || !canTransform(photo.url) || isCardDerivative(photo.url)) {
    return undefined;
  }
  const small = photo.thumbnailUrl
    ? `${photo.thumbnailUrl} ${CARD_RENDER_WIDTH}w`
    : `${supabaseCardSrc(photo.url)} ${CARD_RENDER_WIDTH}w`;
  const sharp = CARD_SHARP_WIDTHS.map((width) => {
    const src = supabaseTransformSrc(
      photo.url,
      width,
      cardFrameHeight(width),
      "cover",
      CARD_SHARP_QUALITY,
    );
    return `${src} ${width}w`;
  });
  return [small, ...sharp].join(", ");
}

/** Foto da galeria do anúncio: miniatura no strip, preview no slide. */
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

/**
 * Arquivo largo da ficha. O WebP do upload (≤1280) segue direto — um
 * segundo encode não fica mais nítido. JPG/PNG antigo vira WebP a 1200px,
 * para o original da câmera não ser o src padrão.
 */
export function galleryPreviewSrc(photo: GalleryPhoto) {
  const url = photo.url;
  if (!canTransform(url) || isOptimizedGalleryWebp(url)) return url;
  return supabaseTransformSrc(url, HERO_CAP_WIDTH, undefined, "contain", HERO_CAP_QUALITY);
}

/**
 * 800px no celular 2x e no desktop 1x; o arquivo da galeria (1280) quando
 * a tela é maior. A miniatura 480 do card não entra: é outro recorte e
 * fica mole na foto grande.
 */
export function galleryPreviewSrcSet(photo: GalleryPhoto) {
  const url = photo.url;
  if (!url || !canTransform(url) || isCardDerivative(url)) return undefined;
  const narrow = supabaseTransformSrc(
    url,
    HERO_NARROW_WIDTH,
    undefined,
    "contain",
    HERO_NARROW_QUALITY,
  );
  const wide = galleryPreviewSrc(photo);
  const wideW = wide === url ? GALLERY_FILE_WIDTH : HERO_CAP_WIDTH;
  if (narrow === wide) return undefined;
  return `${narrow} ${HERO_NARROW_WIDTH}w, ${wide} ${wideW}w`;
}

/**
 * Carrega só o slide ativo e os vizinhos. Os `li` continuam no DOM para o
 * snap; as fotos longe não baixam o WebP de 1280px (cota Hobby / 3G).
 */
export function shouldLoadGallerySlide(index: number, active: number) {
  return Math.abs(index - active) <= 1;
}

export type StockFilters = {
  q?: string;
  category?: string;
  brand?: string;
  /** Modelo do anúncio — o campo `model`, não a versão. */
  model?: string;
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
  /** Cidade física do veículo, entre as opções do admin. */
  city?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

/** Parâmetros que estreitam a lista. Ordenação fica de fora. */
export const STOCK_FILTER_KEYS = [
  "q",
  "category",
  "brand",
  "model",
  "transmission",
  "fuel",
  "color",
  "accessory",
  "laudo",
  "minPrice",
  "maxPrice",
  "minYear",
  "maxYear",
  "maxKm",
  "city",
] as const;

export type StockPageResult = {
  vehicles: VehicleCardRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  suggestions?: { query: string; count: number }[];
  error?: string;
};

export const STOCK_SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "menor-km", label: "Menor KM" },
  { value: "mais-novo", label: "Ano mais novo" },
  { value: "nome", label: "Nome (A–Z)" },
] as const;

export type StockSortValue = (typeof STOCK_SORT_OPTIONS)[number]["value"];

/** Where parcial pela localização do veículo, não pela região atendida. */
export function stockCityFilter(value?: string | null) {
  const city = parseVehicleLocationCity(value);
  return city ? { locationCity: city } : {};
}

export function stockSortLabel(sort?: string | null) {
  const key = (sort || "recentes").trim();
  const found = STOCK_SORT_OPTIONS.find((option) => option.value === key);
  return found?.label ?? "Mais recentes";
}

/** Ordenação fora do padrão: a lista precisa da consulta, não do HTML recente. */
export function isActiveStockSort(sort?: string | null) {
  const key = (sort ?? "").trim();
  if (!key || key === "recentes") return false;
  return STOCK_SORT_OPTIONS.some((option) => option.value === key);
}

/**
 * Marca, modelo, ano, preço, km (e os outros filtros já existentes) ou uma
 * ordem que não seja “mais recentes”. A página sem query continua estática.
 */
export function stockViewNeedsFetch(
  input: Partial<Record<(typeof STOCK_FILTER_KEYS)[number] | "sort", string | undefined>>,
) {
  if (STOCK_FILTER_KEYS.some((key) => Boolean(input[key]))) return true;
  return isActiveStockSort(input.sort);
}

export type StockOrderBy =
  | Record<string, "asc" | "desc">
  | Array<Record<string, "asc" | "desc">>;

/** Preço, km, ano e nome. O restante cai em mais recentes. */
export function stockOrderBy(sort?: string | null): StockOrderBy {
  switch ((sort ?? "recentes").trim()) {
    case "menor-preco":
      return { price: "asc" };
    case "maior-preco":
      return { price: "desc" };
    case "menor-km":
      return { km: "asc" };
    case "mais-novo":
      return { yearModel: "desc" };
    case "nome":
      return [{ brand: "asc" }, { model: "asc" }];
    default:
      return { createdAt: "desc" };
  }
}

export type StockModelOption = {
  brand: string;
  model: string;
};

function foldLabel(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

/** Modelos do estoque. Com marca, só os daquela marca. */
export function modelsForBrand(
  models: readonly StockModelOption[] | undefined,
  brand?: string | null,
) {
  const selected = foldLabel(brand ?? "");
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of models ?? []) {
    const name = item.model?.trim();
    if (!name) continue;
    if (selected && foldLabel(item.brand ?? "") !== selected) continue;
    const key = foldLabel(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  names.sort((a, b) => a.localeCompare(b, "pt-BR"));
  return names;
}

/** Opções do select, mantendo um modelo da URL que saiu do estoque. */
export function modelFilterOptions(
  models: readonly StockModelOption[] | undefined,
  brand: string | undefined,
  selected: string | undefined,
) {
  const options = modelsForBrand(models, brand);
  const current = (selected ?? "").trim();
  if (!current) return options;
  const exists = options.some((name) => foldLabel(name) === foldLabel(current));
  return exists ? options : [current, ...options];
}

/** Trocar a marca solta o modelo quando ele não pertence à marca nova. */
export function modelAfterBrandChange(
  models: readonly StockModelOption[] | undefined,
  brand: string,
  model: string,
) {
  const current = model.trim();
  if (!current) return "";
  const match = modelsForBrand(models, brand).find(
    (name) => foldLabel(name) === foldLabel(current),
  );
  return match ?? "";
}

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
    model: pickParam(input, "model"),
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
    city: parseVehicleLocationCity(pickParam(input, "city")) ?? undefined,
    sort: pickParam(input, "sort"),
    page: options?.page ?? Math.max(1, Number(pickParam(input, "page")) || 1),
    pageSize: optionalPositiveNumber(pickParam(input, "pageSize")),
  };
}
