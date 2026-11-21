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

/**
 * Rótulo curto exibido abaixo da foto:
 * - Com modelo: "{Modelo} vendido" (ex.: "Onix vendido", "Kicks Sense vendido")
 * - Só marca: "{Marca} vendido"
 * - Sem modelo nem marca: "Vendido"
 */
export function formatInstaCaption(
  item: Pick<InstaDeliveryItem, "brand" | "model">,
): string {
  const model = item.model?.trim();
  if (model) return `${model} vendido`;
  const brand = item.brand?.trim();
  if (brand) return `${brand} vendido`;
  return "Vendido";
}

/**
 * Texto alternativo da imagem:
 * "{Marca Modelo} vendido pela Sua Garagem" ou "Veículo vendido pela Sua Garagem".
 */
export function formatInstaAlt(
  item: Pick<InstaDeliveryItem, "brand" | "model">,
): string {
  const parts = [item.brand?.trim(), item.model?.trim()].filter(Boolean);
  if (parts.length > 0) {
    return `${parts.join(" ")} vendido pela Sua Garagem`;
  }
  return "Veículo vendido pela Sua Garagem";
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
