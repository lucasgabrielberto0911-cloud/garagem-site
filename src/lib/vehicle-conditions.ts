/**
 * Bloco único da ficha do veículo (perto do CTA).
 * Garantia: texto oficial da loja. O restante ainda se edita em Admin → Site.
 * Não inventar documentação, vistoria ou custo que a loja não confirmou.
 */

/** Texto oficial da garantia — ficha, FAQ e defaults do painel. */
export const STORE_WARRANTY = {
  title: "Garantia de 3 meses (motor e câmbio)",
  summary: "3 meses de cobertura para motor e câmbio em todos os nossos seminovos.",
  body:
    "Na Sua Garagem, todo veículo passa por uma revisão completa antes de chegar até você. Por isso, oferecemos 3 meses de garantia em todos os nossos seminovos, com cobertura para os itens que mais pesam no bolso: motor e câmbio. Desgaste natural, mau uso e itens de manutenção (pneus, pastilhas, filtros) ficam de fora — em dúvida, pergunte no WhatsApp.",
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
      text: "Combinamos a transferência pelo WhatsApp. Custos de Detran, despachante e deslocamento variam por caso — não há taxa fixa no site. Confirme com o consultor antes de fechar.",
    },
    {
      label: "Vistoria",
      text: "Todo seminovo passa por checagem de procedência e condição geral antes do anúncio. Laudo cautelar só aparece na ficha quando constar no campo Laudo.",
    },
    {
      label: "Entrega",
      text: "Somos loja digital: visita, entrega ou retirada são combinadas no WhatsApp. Não publicamos valor de frete — depende da cidade e do veículo.",
    },
    {
      label: "O que a garantia não cobre",
      text: "A cobertura de 3 meses é de motor e câmbio. Desgaste natural, mau uso e peças de manutenção (pneus, pastilhas, filtros etc.) ficam de fora.",
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
