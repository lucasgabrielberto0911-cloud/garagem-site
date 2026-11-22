/**
 * Grade de cards em 2 colunas no celular: a regra global de `.listing-card-grid`
 * estica o último card ímpar para a linha inteira. Para evitar esse card largo,
 * a partir de 3 itens a quantidade fica par; 1 item sozinho é tratado pelo
 * chamador com `[&_.listing-card-item]:!col-span-1`.
 */
export function evenVehicleGridItems<T>(items: readonly T[]): T[] {
  if (items.length >= 3 && items.length % 2 === 1) {
    return items.slice(0, items.length - 1);
  }
  return [...items];
}
