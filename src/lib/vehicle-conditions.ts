/**
 * Bloco único da ficha do veículo (perto do CTA).
 * PREENCHER com a política real da loja — não inventar prazo, cobertura ou custo.
 */
export const VEHICLE_CONDITIONS = {
  title: "Garantia e condições",
  intro:
    "PREENCHER: condições reais de garantia, documentação e transferência",
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
} as const;

export function isPlaceholderCopy(value: string) {
  return value.includes("PREENCHER") || value.includes("[");
}
