/**
 * Bloco único da ficha do veículo (perto do CTA).
 * Garantia: texto oficial da loja. O restante ainda se edita em Admin → Site.
 * Não inventar documentação, vistoria ou custo que a loja não confirmou.
 */

/** Texto oficial da garantia — ficha, FAQ e defaults do painel. */
export const STORE_WARRANTY = {
  title: "Garantia de 3 Meses Garagem",
  summary: "3 meses de cobertura para motor e câmbio em todos os nossos carros.",
  body:
    "Na Garagem, todo veículo passa por uma revisão completa antes de chegar até você. Por isso, oferecemos 3 meses de garantia em todos os nossos carros, com cobertura para os itens que mais pesam no bolso: motor e câmbio.",
} as const;

export type ConditionItem = {
  label: string;
  text: string;
};

export type VehicleConditionsContent = {
  title: string;
  intro: string;
  items: ConditionItem[];
};

export const DEFAULT_VEHICLE_CONDITIONS: VehicleConditionsContent = {
  title: STORE_WARRANTY.title,
  intro: STORE_WARRANTY.body,
  items: [
    {
      label: "Garantia",
      text: STORE_WARRANTY.summary,
    },
    {
      label: "Documentação e transferência",
      text: "PREENCHER: o que a loja cuida e o que fica com o comprador",
    },
    {
      label: "Vistoria",
      text: "PREENCHER: o que é checado antes do anúncio e se há laudo",
    },
  ],
};

/** @deprecated Use DEFAULT_VEHICLE_CONDITIONS ou getVehicleConditions(). */
export const VEHICLE_CONDITIONS = DEFAULT_VEHICLE_CONDITIONS;

export function isPlaceholderCopy(value: string) {
  return value.includes("PREENCHER") || value.includes("[");
}

export function publishedConditionItems(items: ConditionItem[]) {
  return items.filter(
    (item) => item.label.trim() && item.text.trim() && !isPlaceholderCopy(item.text),
  );
}
