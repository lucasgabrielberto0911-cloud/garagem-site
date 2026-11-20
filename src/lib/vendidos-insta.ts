export type InstaDeliveryItem = {
  id: string;
  date: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  src: string;
  href: string;
};

export const INSTA_DELIVERIES_PAGE_SIZE = 24;

const MONTHS_PT_BR = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/**
 * Converte data ISO "AAAA-MM-DD" para "mês/AAAA" em pt-BR (ex.: "nov/2026"),
 * sem depender de fuso horário ou pontuação de locale.
 */
export function formatInstaMonthYear(date: string): string {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(date.trim());
  if (!match) return date.trim();
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  const month = MONTHS_PT_BR[monthIndex];
  if (!month) return year;
  return `${month}/${year}`;
}

/**
 * Retorna "Marca Modelo Ano" quando houver modelo; caso contrário, `null`
 * (mesmo se houver marca/ano isolados sem modelo).
 */
export function formatInstaVehicleLabel(
  item: Pick<InstaDeliveryItem, "brand" | "model" | "year">,
): string | null {
  const model = item.model?.trim();
  if (!model) return null;
  const brand = item.brand?.trim();
  const year =
    typeof item.year === "number" && Number.isFinite(item.year)
      ? String(item.year)
      : null;
  return [brand, model, year].filter(Boolean).join(" ");
}

/**
 * Legenda principal exibida abaixo da foto:
 * - Com modelo: "Marca Modelo Ano" (ou "Marca Modelo" sem ano)
 * - Sem modelo: "Entregue em mês/ano" (ex.: "Entregue em nov/2026")
 */
export function formatInstaCaption(
  item: Pick<InstaDeliveryItem, "brand" | "model" | "year" | "date">,
): string {
  const vehicle = formatInstaVehicleLabel(item);
  if (vehicle) return vehicle;
  return `Entregue em ${formatInstaMonthYear(item.date)}`;
}

/**
 * Texto alternativo da imagem conforme especificação:
 * "Entrega de {marca modelo ano}" ou "Entrega de veículo da Sua Garagem em {mês/ano}".
 */
export function formatInstaAlt(
  item: Pick<InstaDeliveryItem, "brand" | "model" | "year" | "date">,
): string {
  const vehicle = formatInstaVehicleLabel(item);
  if (vehicle) return `Entrega de ${vehicle}`;
  return `Entrega de veículo da Sua Garagem em ${formatInstaMonthYear(item.date)}`;
}

/** Rótulo acessível para o link que abre o post original no Instagram em nova aba. */
export function formatInstaAriaLabel(
  item: Pick<InstaDeliveryItem, "brand" | "model" | "year" | "date">,
): string {
  const vehicle = formatInstaVehicleLabel(item);
  const monthYear = formatInstaMonthYear(item.date);
  if (vehicle) {
    return `Ver entrega de ${vehicle} (${monthYear}) no Instagram (abre em nova aba)`;
  }
  return `Ver entrega de ${monthYear} no Instagram (abre em nova aba)`;
}

/** Fatia os itens visíveis respeitando limites seguros. */
export function sliceInstaDeliveries<T>(
  items: readonly T[],
  visibleCount: number,
): T[] {
  const safeCount = Math.max(0, Math.min(items.length, Math.trunc(visibleCount)));
  return items.slice(0, safeCount);
}

/** Calcula o próximo total visível somando um lote (+24 por padrão) até o limite. */
export function nextInstaDeliveriesCount(
  currentCount: number,
  total: number,
  step: number = INSTA_DELIVERIES_PAGE_SIZE,
): number {
  const safeStep = Math.max(1, Math.trunc(step));
  return Math.min(Math.max(0, total), Math.max(0, Math.trunc(currentCount)) + safeStep);
}
