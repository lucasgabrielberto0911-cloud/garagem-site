/**
 * Bloco único da ficha do veículo (perto do CTA).
 * Defaults com PREENCHER — o texto real se edita em Admin → Site.
 * Não inventar prazo, cobertura ou custo.
 */

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
  title: "Garantia e condições",
  intro: "PREENCHER: condições reais de garantia, documentação e transferência",
  items: [
    {
      label: "Garantia",
      text: "PREENCHER: prazo e cobertura da garantia (ou se varia por veículo)",
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
