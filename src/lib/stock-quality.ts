/**
 * Lacunas do anúncio.
 * Na listagem do painel isso vira no máximo uma linha muda (foto e estoque parado).
 * Vídeo, cor e câmbio ficam na tela de edição — sem badge em cada card.
 */

import { transmissionConflictAlert } from "@/lib/vehicle-display";

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
