export type InstaDeliveryItem = {
  id: string;
  date: string;
  brand: string | null;
  model: string | null;
  src: string;
};

export type InstaDeliveryLabels = {
  /** Marca discreta exibida acima do modelo quando ambos existem. */
  eyebrow: string | null;
  /** Rótulo principal em destaque: modelo, só marca ou "Veículo entregue". */
  title: string;
};

export const INSTA_DELIVERIES_PAGE_SIZE = 24;

/**
 * Rótulos exibidos abaixo da foto:
 * - Marca + modelo: marca pequena (eyebrow) e modelo em destaque (title)
 * - Só modelo: modelo em destaque
 * - Só marca: marca em destaque
 * - Sem marca nem modelo: "Veículo entregue"
 */
export function formatInstaLabels(
  item: Pick<InstaDeliveryItem, "brand" | "model">,
): InstaDeliveryLabels {
  const brand = item.brand?.trim() || null;
  const model = item.model?.trim() || null;

  if (brand && model) {
    return { eyebrow: brand, title: model };
  }
  if (model) {
    return { eyebrow: null, title: model };
  }
  if (brand) {
    return { eyebrow: null, title: brand };
  }
  return { eyebrow: null, title: "Veículo entregue" };
}

/**
 * Texto alternativo da imagem:
 * "{Marca Modelo} entregue a cliente da Sua Garagem" ou
 * "Veículo entregue a cliente da Sua Garagem".
 */
export function formatInstaAlt(
  item: Pick<InstaDeliveryItem, "brand" | "model">,
): string {
  const parts = [item.brand?.trim(), item.model?.trim()].filter(Boolean);
  if (parts.length > 0) {
    return `${parts.join(" ")} entregue a cliente da Sua Garagem`;
  }
  return "Veículo entregue a cliente da Sua Garagem";
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
  return Math.min(
    Math.max(0, total),
    Math.max(0, Math.trunc(currentCount)) + safeStep,
  );
}
