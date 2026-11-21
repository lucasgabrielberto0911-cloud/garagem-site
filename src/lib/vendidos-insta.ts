export type InstaDeliveryItem = {
  id: string;
  date: string;
  brand: string | null;
  model: string | null;
  src: string;
  srcSmall: string;
  lqip: string;
};

export type InstaDeliveryLabels = {
  /** Marca discreta exibida acima do modelo quando ambos existem. */
  eyebrow: string | null;
  /** Rótulo principal em destaque: modelo, só marca ou "Veículo entregue". */
  title: string;
};

export const INSTA_DELIVERIES_PAGE_SIZE = 24;

/** Larguras reais do card na grade: 4 colunas no desktop (container 90rem) e 2 no celular. */
export const INSTA_DELIVERIES_SIZES =
  "(min-width: 1440px) 326px, (min-width: 1024px) 23vw, (min-width: 640px) 45vw, 46vw";

/** Salvaguarda para nunca deixar foto presa em opacity 0 se o evento load não disparar. */
export const INSTA_DELIVERY_FADE_FALLBACK_MS = 2500;

const SAFE_WEBP_DATA_URI = /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/;

/** Valida se o LQIP é um data URI WebP compacto e seguro para uso em background-image. */
export function isValidInstaLqip(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length < 400 &&
    SAFE_WEBP_DATA_URI.test(value)
  );
}

/** Monta o srcset responsivo com a miniatura 360w e a foto completa 600w. */
export function buildInstaSrcSet(
  item: Pick<InstaDeliveryItem, "srcSmall" | "src">,
): string {
  return `${item.srcSmall} 360w, ${item.src} 600w`;
}

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
