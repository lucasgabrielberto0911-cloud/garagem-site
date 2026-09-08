import {
  formatCurrencyBRL,
  formatModelName,
  formatNumberBR,
  formatVehicleLabel,
} from "@/lib/format";
import { coverSrc } from "@/lib/stock-query";
import { vehiclePath } from "@/lib/vehicle-slug";
import type { ChatVehicleRecord } from "@/lib/chat-stock";

export type ChatVehicleCard = {
  id: string;
  href: string;
  title: string;
  version: string | null;
  year: number;
  km: number;
  price: number;
  color: string | null;
  photo: string | null;
};

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function priceInText(text: string, price: number) {
  const rounded = Math.round(price);
  const br = rounded.toLocaleString("pt-BR");
  return text.includes(br) || text.includes(String(rounded));
}

export function isChatVehicleListingLine(line: string) {
  const trimmed = line.trim().replace(/^[-•*\d.)\s]+/, "");
  if (!trimmed) return false;
  const hasKm = /[\d.]+\s*km/i.test(trimmed);
  const hasPrice = /R\$\s*\d/.test(trimmed);
  if (!hasKm || !hasPrice) return false;
  if (
    /^(temos o|temos um|aceita|financi|garantia|atendemos|sempre|parcela)/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  return /·/.test(trimmed) || trimmed.length < 160;
}

export function stripChatVehicleListingLines(text: string) {
  return text
    .split("\n")
    .filter((line) => !isChatVehicleListingLine(line))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scoreVehicleInText(
  vehicle: ChatVehicleRecord,
  foldedHay: string,
  raw: string,
) {
  const brand = fold(vehicle.brand);
  const model = fold(vehicle.model);
  let score = 0;
  if (brand && foldedHay.includes(brand)) score += 2;
  if (model && foldedHay.includes(model)) score += 3;
  if (raw.includes(String(vehicle.yearModel))) score += 1;
  if (priceInText(raw, vehicle.price)) score += 2;
  return score;
}

function bestMatchForSnippet(
  snippet: string,
  stock: ChatVehicleRecord[],
  seen: Set<string>,
) {
  const folded = fold(snippet);
  let best: ChatVehicleRecord | null = null;
  let bestScore = 0;
  for (const vehicle of stock) {
    if (seen.has(vehicle.id)) continue;
    const score = scoreVehicleInText(vehicle, folded, snippet);
    if (score > bestScore) {
      best = vehicle;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

/** Casa o texto do assistente com anúncios reais do estoque, na ordem citada. */
export function matchVehiclesInReply(
  reply: string,
  stock: ChatVehicleRecord[],
  limit = 5,
) {
  if (!reply.trim() || stock.length === 0) return [];

  const found: ChatVehicleRecord[] = [];
  const seen = new Set<string>();

  for (const line of reply.split("\n")) {
    const listing =
      isChatVehicleListingLine(line) ||
      (/[\d.]+\s*km/i.test(line) && /R\$\s*\d/.test(line));
    if (!listing) continue;
    const match = bestMatchForSnippet(line, stock, seen);
    if (!match) continue;
    seen.add(match.id);
    found.push(match);
    if (found.length >= limit) return found;
  }

  if (found.length > 0) return found;

  const foldedReply = fold(reply);
  const ranked = stock
    .map((vehicle) => ({
      vehicle,
      score: scoreVehicleInText(vehicle, foldedReply, reply),
    }))
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (seen.has(item.vehicle.id)) continue;
    seen.add(item.vehicle.id);
    found.push(item.vehicle);
    if (found.length >= limit) break;
  }
  return found;
}

export function toChatVehicleCard(vehicle: ChatVehicleRecord): ChatVehicleCard {
  const version = vehicle.version?.trim() || null;
  const color = vehicle.color?.trim() || null;
  return {
    id: vehicle.id,
    href: vehiclePath(vehicle),
    title: formatVehicleLabel(vehicle.brand, vehicle.model),
    version,
    year: vehicle.yearModel,
    km: vehicle.km,
    price: vehicle.price,
    color,
    photo: coverSrc(vehicle.photos ?? []) ?? null,
  };
}

export function chatVehicleMeta(vehicle: ChatVehicleCard) {
  const bits = [
    String(vehicle.year),
    vehicle.color,
    `${formatNumberBR(vehicle.km)} km`,
  ].filter(Boolean);
  return bits.join(" · ");
}

export function chatVehiclePrice(vehicle: ChatVehicleCard) {
  return formatCurrencyBRL(vehicle.price);
}

export function chatVehicleVersion(vehicle: ChatVehicleCard) {
  return vehicle.version ? formatModelName(vehicle.version) : null;
}
