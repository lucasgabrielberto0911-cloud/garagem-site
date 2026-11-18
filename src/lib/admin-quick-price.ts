/** Edição rápida de preço na lista do admin — só preço à vista, sem parcela. */

import { parseMoneyBR } from "./admin-money";
import { descriptionPriceSaveError } from "./admin-vehicle-validate";

export const QUICK_PRICE_MIN = 1;
export const QUICK_PRICE_MAX = 9_999_999;

/** Interpreta o que a pessoa digitou (ex.: "45.900,00", "45900", "R$ 45.900"). */
export function parseQuickPrice(value: unknown): number | null {
  const parsed = parseMoneyBR(value);
  if (parsed == null) return null;
  if (parsed < QUICK_PRICE_MIN || parsed > QUICK_PRICE_MAX) return null;
  return parsed;
}

/**
 * Erro em português simples para mostrar perto do campo.
 * Vendido não muda de preço; disponível trava se a descrição citar outro valor.
 */
export function quickPriceError(input: {
  raw: unknown;
  status?: string | null;
  description?: string | null;
}): string | null {
  if (input.status === "vendido") {
    return "Veículo vendido não muda de preço.";
  }
  const price = parseQuickPrice(input.raw);
  if (price == null) {
    return "Digite o preço à vista, só números. Exemplo: 45.900,00.";
  }
  const blocked = descriptionPriceSaveError({
    description: input.description,
    price,
    status: input.status,
  });
  if (blocked) return blocked;
  return null;
}

/** Texto neutro do botão de venda simples (vale para qualquer veículo). */
export const SIMPLE_SOLD_LABEL = "Marcar como vendido";
