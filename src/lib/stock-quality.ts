/**
 * Lacunas do anúncio.
 * Na listagem do painel isso vira no máximo uma linha muda (foto e estoque parado).
 * Vídeo, cor e câmbio ficam na tela de edição — sem badge em cada card.
 */

import type {
  VehicleFormSectionId,
  VehicleWizardStep,
} from "@/lib/admin-form-sections";
import {
  descriptionPriceMismatch,
  descriptionPriceMismatchBlocksSave,
  MIN_LISTING_PRICE,
} from "@/lib/admin-vehicle-validate";
import { transmissionConflictAlert } from "@/lib/vehicle-display";
import { parseVehicleLocationCity } from "@/lib/vehicle-location";

export { transmissionConflictAlert };

const DAY_MS = 1000 * 60 * 60 * 24;

/** Disponível parado há mais tempo que isso entra nos alertas. */
export const STALE_DAYS = 60;

export function daysInStock(createdAt: Date) {
  return Math.floor((Date.now() - createdAt.getTime()) / DAY_MS);
}

export function isStaleListing(createdAt: Date, status?: string) {
  if (status && status !== "disponivel") return false;
  return daysInStock(createdAt) >= STALE_DAYS;
}

export function staleCutoffDate(days = STALE_DAYS) {
  return new Date(Date.now() - days * DAY_MS);
}

export type ListingGapInput = {
  color?: string | null;
  photos?: unknown[] | null;
  price?: number | null;
};

/** Lacunas do anúncio no lote diário — cor, fotos e preço. */
export function listingGapBadges(vehicle: ListingGapInput): string[] {
  const badges: string[] = [];
  if (!vehicle.color?.trim()) badges.push("Sem cor");
  if (!vehicle.photos || vehicle.photos.length === 0) badges.push("Sem fotos");
  if (
    vehicle.price == null ||
    !Number.isFinite(vehicle.price) ||
    vehicle.price <= 0
  ) {
    badges.push("Sem preço");
  }
  return badges;
}

export type EditListingGapInput = {
  status?: string | null;
  color?: string | null;
  photoCount?: number | null;
  price?: number | null;
  hasVideo?: boolean | null;
  version?: string | null;
  transmission?: string | null;
};

/**
 * Pendências do cadastro, só para a tela de edição.
 * Vendido não lista lacuna: o anúncio já saiu do estoque ativo.
 */
export function editListingGaps(input: EditListingGapInput): string[] {
  if (input.status === "vendido") return [];
  const gaps: string[] = [];
  const badges = listingGapBadges({
    color: input.color,
    photos: (input.photoCount ?? 0) > 0 ? [{}] : [],
    price: input.price,
  });
  if (badges.includes("Sem fotos")) gaps.push("fotos");
  if (badges.includes("Sem preço")) gaps.push("preço");
  if (badges.includes("Sem cor")) gaps.push("cor");
  if (!input.hasVideo) gaps.push("vídeo");
  if (transmissionConflictAlert(input.version, input.transmission)) {
    gaps.push("câmbio da versão");
  }
  return gaps;
}

/** Uma linha muda no topo da edição. Null quando não falta nada. */
export function editListingGapLine(input: EditListingGapInput): string | null {
  const gaps = editListingGaps(input);
  if (gaps.length === 0) return null;
  return `Falta no cadastro: ${gaps.join(", ")}`;
}

export type PublishGapId =
  | "fotos"
  | "marca"
  | "modelo"
  | "preco"
  | "ano"
  | "km"
  | "cambio"
  | "combustivel"
  | "cor"
  | "preco-legenda"
  | "cidade";

export type PublishGapItem = {
  id: PublishGapId;
  /** Rótulo curto exibido na linha única "Falta: foto de capa, preço". */
  label: string;
  /** Nome do campo no formulário para foco direto ao tocar. */
  field: string;
  /** Seção do formulário onde o campo mora. */
  section: VehicleFormSectionId;
  /** Etapa do wizard (1 a 4). */
  step: VehicleWizardStep;
};

export type PublishGapInput = {
  status?: string | null;
  photoCount?: number | null;
  photos?: readonly unknown[] | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  year?: number | string | null;
  yearModel?: number | string | null;
  km?: number | string | null;
  transmission?: string | null;
  fuel?: string | null;
  color?: string | null;
  price?: number | string | null;
  description?: string | null;
  locationCity?: string | null;
};

export type PublishChecklistItem = PublishGapItem;
export type PublishChecklistInput = PublishGapInput;

function parsePriceValue(
  price: number | string | null | undefined,
): number | null {
  if (typeof price === "number") {
    return Number.isFinite(price) && price >= MIN_LISTING_PRICE ? price : null;
  }
  if (typeof price === "string") {
    const cleaned = price
      .replace(/R\$/gi, "")
      .replace(/\s+/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) && num >= MIN_LISTING_PRICE ? num : null;
  }
  return null;
}

function hasValidYear(value: number | string | null | undefined): boolean {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1900 && value <= 2100;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d{4}$/.test(trimmed)) return false;
    const num = Number(trimmed);
    return num >= 1900 && num <= 2100;
  }
  return false;
}

function hasValidKm(value: number | string | null | undefined): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0;
  }
  if (typeof value === "string") {
    return value.replace(/\D/g, "").length > 0;
  }
  return false;
}

/**
 * Lista única do que falta para publicar o anúncio (G7 / X4 / M3).
 * Veículo vendido nunca lista pendência nem preço.
 */
export function publishMissingItems(input: PublishGapInput): PublishGapItem[] {
  if (input.status === "vendido") return [];

  const items: PublishGapItem[] = [];
  const hasPhotoField =
    input.photoCount !== undefined || input.photos !== undefined;
  const photoCount =
    input.photoCount != null
      ? input.photoCount
      : Array.isArray(input.photos)
        ? input.photos.length
        : 0;

  if (hasPhotoField && photoCount <= 0) {
    items.push({
      id: "fotos",
      label: "foto de capa",
      field: "photos",
      section: "fotos",
      step: 1,
    });
  }

  if (input.brand !== undefined && !String(input.brand ?? "").trim()) {
    items.push({
      id: "marca",
      label: "marca",
      field: "brand",
      section: "identificacao",
      step: 2,
    });
  }

  if (input.model !== undefined && !String(input.model ?? "").trim()) {
    items.push({
      id: "modelo",
      label: "modelo",
      field: "model",
      section: "identificacao",
      step: 2,
    });
  }

  const numericPrice = parsePriceValue(input.price);
  if (input.price !== undefined && numericPrice === null) {
    items.push({
      id: "preco",
      label: "preço",
      field: "priceDisplay",
      section: "essencial",
      step: 3,
    });
  }

  if (input.year !== undefined && !hasValidYear(input.year)) {
    items.push({
      id: "ano",
      label: "ano",
      field: "year",
      section: "ficha",
      step: 2,
    });
  } else if (input.yearModel !== undefined && !hasValidYear(input.yearModel)) {
    items.push({
      id: "ano",
      label: "ano",
      field: "yearModel",
      section: "ficha",
      step: 2,
    });
  }

  if (input.km !== undefined && !hasValidKm(input.km)) {
    items.push({
      id: "km",
      label: "km",
      field: "kmDisplay",
      section: "ficha",
      step: 2,
    });
  }

  const conflict = transmissionConflictAlert(input.version, input.transmission);
  if (
    input.transmission !== undefined &&
    !String(input.transmission ?? "").trim()
  ) {
    items.push({
      id: "cambio",
      label: "câmbio",
      field: "transmission",
      section: "ficha",
      step: 2,
    });
  } else if (conflict) {
    items.push({
      id: "cambio",
      label: "câmbio da versão",
      field: "transmission",
      section: "ficha",
      step: 2,
    });
  }

  if (input.fuel !== undefined && !String(input.fuel ?? "").trim()) {
    items.push({
      id: "combustivel",
      label: "combustível",
      field: "fuel",
      section: "ficha",
      step: 2,
    });
  }

  if (input.color !== undefined && !String(input.color ?? "").trim()) {
    items.push({
      id: "cor",
      label: "cor",
      field: "color",
      section: "identificacao",
      step: 2,
    });
  }

  if (
    numericPrice !== null &&
    input.description &&
    descriptionPriceMismatchBlocksSave(input.status) &&
    descriptionPriceMismatch(input.description, numericPrice)
  ) {
    items.push({
      id: "preco-legenda",
      label: "preço na legenda",
      field: "description",
      section: "itens",
      step: 3,
    });
  }

  if (
    input.locationCity !== undefined &&
    !parseVehicleLocationCity(input.locationCity)
  ) {
    items.push({
      id: "cidade",
      label: "cidade",
      field: "locationCity",
      section: "essencial",
      step: 4,
    });
  }

  return items;
}

/**
 * Linha única "Falta: foto de capa, preço" (X4 / M3).
 * Retorna null quando não falta nada para publicar.
 */
export function publishMissingLine(
  input: PublishGapInput,
  prefix = "Falta:",
): string | null {
  const items = publishMissingItems(input);
  if (items.length === 0) return null;
  return `${prefix} ${items.map((item) => item.label).join(", ")}`;
}

export const publishChecklistItems = publishMissingItems;
export const publishChecklistLine = publishMissingLine;

/**
 * Resumo da aba Em estoque. Não cita vídeo: isso não é aviso de lista.
 * Null quando não há foto faltando nem carro parado.
 */
export function stockListQuietNote(input: {
  withoutPhotos: number;
  stale: number;
  staleDays: number;
}): string | null {
  const parts: string[] = [];
  if (input.withoutPhotos > 0) {
    parts.push(
      input.withoutPhotos === 1
        ? "1 anúncio sem foto"
        : `${input.withoutPhotos} anúncios sem foto`,
    );
  }
  if (input.stale > 0) {
    parts.push(
      input.stale === 1
        ? `1 parado há mais de ${input.staleDays} dias`
        : `${input.stale} parados há mais de ${input.staleDays} dias`,
    );
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function formatRelativeUpdatedAt(
  value: Date | string,
  now = Date.now(),
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = now - date.getTime();
  if (diff < 0) return "agora";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "há 1 h" : `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "há 1 dia";
  if (days < 30) return `há ${days} dias`;
  return date.toLocaleDateString("pt-BR");
}
