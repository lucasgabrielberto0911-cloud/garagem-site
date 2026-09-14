/** Avisos de qualidade do anúncio (painel de estoque e dashboard). */

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
