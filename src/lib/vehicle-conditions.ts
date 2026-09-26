/**
 * Bloco único da ficha do veículo (perto do CTA).
 * Garantia: texto oficial da loja — cobertura comercial de motor e câmbio.
 * O restante ainda se edita em Admin → Site.
 * Não inventar documentação, vistoria, direito do CDC ou custo que a loja não confirmou.
 */

/**
 * Texto público da vistoria da loja.
 * Tom de consultor: o que a loja confere, sem aviso de documento oficial.
 */
export const STORE_INSPECTION_BODY =
  "Antes de anunciar, a gente vistoria cada carro na loja. Confere óleo, fluidos e a condição geral — é assim com todo seminovo do estoque.";

const LEGACY_STORE_INSPECTION =
  /checagem interna de proced[eê]ncia/i;

/** Frase antiga do anúncio / painel que pedia desculpa por não ser laudo. */
export function isLegacyStoreInspectionCopy(value: string) {
  return LEGACY_STORE_INSPECTION.test(value);
}

/** Tira só a frase de documento oficial. O restante do texto fica. */
export function withoutInspectionDisclaimer(value: string) {
  const kept = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !/documento oficial/i.test(sentence));
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Texto da vistoria na ficha pública.
 * Vazio ou o parágrafo antigo (com ou sem o aviso) vira o texto positivo.
 * Nota própria do anúncio, sem esse aviso, permanece.
 */
export function publicStoreInspectionText(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text || isLegacyStoreInspectionCopy(text)) return STORE_INSPECTION_BODY;
  return withoutInspectionDisclaimer(text) || STORE_INSPECTION_BODY;
}

/** Texto oficial da garantia — ficha, FAQ e defaults do painel. */
export const STORE_WARRANTY = {
  title: "Garantia de 3 meses (motor e câmbio)",
  summary:
    "Garantia comercial de 3 meses para motor e câmbio em todos os seminovos.",
  body:
    "Todo seminovo passa por checagem na loja antes do anúncio. A loja oferece garantia comercial de 3 meses para motor e câmbio. Desgaste natural, mau uso e itens de manutenção (pneus, pastilhas, filtros) ficam de fora. Detalhes do seu caso: WhatsApp.",
} as const;

/** Parágrafo antigo que amarrava a garantia a uma “revisão completa”. */
const LEGACY_STORE_WARRANTY =
  /revis[aã]o completa antes de chegar at[eé] voc[eê]/i;

export function isLegacyStoreWarrantyCopy(value: string | null | undefined) {
  return LEGACY_STORE_WARRANTY.test((value ?? "").replace(/\s+/g, " "));
}

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
      label: "Vistoria da loja",
      text: STORE_INSPECTION_BODY,
    },
    {
      label: "Entrega",
      text: "Somos loja digital: visita, entrega ou retirada são combinadas no WhatsApp. Não publicamos valor de frete — depende da cidade e do veículo.",
    },
    {
      label: "O que a garantia não cobre",
      text: "A garantia comercial de 3 meses cobre motor e câmbio. Desgaste natural, mau uso e peças de manutenção (pneus, pastilhas, filtros etc.) ficam de fora.",
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
