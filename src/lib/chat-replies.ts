/**
 * Templates de resposta e formatação de copy do chat da Garagem.
 *
 * Centraliza strings de copy do vendedor e funções puras de formatação,
 * facilitando testes A/B de tom e ajustes sem mexer na lógica do chat.
 */

import { site } from "@/lib/site";
import { formatCurrencyBRL, formatKmBR } from "@/lib/format";
import { shortVersion } from "@/lib/vehicle-display";

export const CHAT_WHATSAPP_URL = `https://wa.me/${site.whatsappNumber}`;

/** Saudações e mensagens iniciais de contato. */
export const GREETING_TEMPLATES = {
  ping:
    "Oi, tô aqui com você. Me conta o orçamento ou o modelo que você procura — eu comparo o estoque em poucas linhas e a gente continua no WhatsApp.",
  hours:
    `Atendemos todos os dias, das 8h às 23h, aqui e no WhatsApp. Pra ver um carro, a visita é com horário marcado: ${CHAT_WHATSAPP_URL}`,
  contact:
    `O WhatsApp da Garagem é ${site.whatsappLabel}, das 8h às 23h, todos os dias: ${CHAT_WHATSAPP_URL}`,
  social:
    `O Instagram da Garagem é ${site.instagram} (${site.instagramUrl}). Pra atendimento, o mais rápido é o WhatsApp: ${CHAT_WHATSAPP_URL}`,
} as const;

/** Respostas quando o estoque não possui o modelo/busca exata. */
export const EMPTY_STOCK_REPLIES = {
  /** Fallback genérico quando o fluxo não conclui normalmente. */
  fallback:
    `Não consegui concluir sua resposta agora. Um consultor continua com você no WhatsApp: ${CHAT_WHATSAPP_URL}`,
  /** Pergunta sobre modelo específico fora da lista atual. */
  missingModel: (name: string | null, waitUrl: string, hasSimilar: boolean) => {
    const subject = name ? `${name} não está na lista atual.` : "Esse modelo não está na lista atual.";
    const wait = `o consultor anota e te avisa no WhatsApp quando chegar: ${waitUrl}`;
    if (!hasSimilar) {
      return `${subject} Posso olhar outro na mesma ideia, ou ${wait}`;
    }
    return `${subject} Separei parecidos que temos, ou ${wait}`;
  },
  /** Perguntas de disponibilidade ampla ("ainda tem?"). */
  availabilityAsk:
    "Me diz o modelo que você quer conferir — eu olho no estoque agora e te falo se ainda tem.",
  /** Comparação ampla sem modelos nomeados ("qual o melhor?"). */
  compareAsk:
    "Me diz os dois modelos que você quer comparar — por exemplo HB20 ou Onix — que eu cruzo o estoque agora, com preço e km reais.",
  /** Carro 0 km não disponível na loja de seminovos. */
  zeroKm:
    "0 km a gente não trabalha: a Garagem vende seminovos. Separei os mais novos do estoque.",
} as const;

/** Respostas e avisos para veículos que já foram vendidos (sem exibir preço). */
export const SOLD_VEHICLE_REPLIES = {
  /** Resposta direta quando o veículo solicitado já foi vendido. */
  soldNotice: (name: string, whatsappHref: string, hasSimilar: boolean) =>
    `O ${name} já foi vendido.${hasSimilar ? " Separei opções parecidas do estoque." : ""} Podemos te avisar quando chegar outro pelo WhatsApp: ${whatsappHref}`,
  /** Unidade específica que já saiu do estoque. */
  unitUnavailable:
    `Essa unidade já saiu do estoque. Se quiser, o consultor procura outra parecida e te avisa no WhatsApp: ${CHAT_WHATSAPP_URL}`,
} as const;

/** Respostas de captura e confirmação de lead (dados de contato). */
export const LEAD_CAPTURE_REPLIES = {
  /** Confirmação padrão enviada ao visitante após registrar o lead. */
  confirmation:
    "Pronto — registrei seu contato. A equipe continua com você no WhatsApp.",
} as const;

/** Mensagens de rate-limit, contenção de abuso e fora de escopo. */
export const ABUSE_LIMIT_REPLIES = {
  /** Limite de mensagens por sessão/IP atingido. */
  rateLimited:
    `Você chegou ao limite de mensagens do assistente por hoje. Chama a gente no WhatsApp que um consultor te atende agora: ${CHAT_WHATSAPP_URL}`,
  /** Primeira tentativa de desvio de escopo da loja. */
  offScope:
    `Essa parte eu deixo com o consultor, mas nos assuntos da Garagem eu te ajudo sim: estoque, compra, venda, troca, financiamento e garantia. Se for outra coisa, chama no WhatsApp: ${CHAT_WHATSAPP_URL}`,
  /** Desvios repetidos de escopo. */
  offScopeRepeat:
    `Só posso ajudar com assuntos da Garagem — chama no WhatsApp pra outros temas: ${CHAT_WHATSAPP_URL}`,
} as const;

/* -------------------------------------------------------------------------- */
/* CARD_FORMATTERS: funções puras de formatação para cards de veículos        */
/* -------------------------------------------------------------------------- */

export type CardFormatterVehicle = {
  title?: string;
  brand?: string;
  model?: string;
  version?: string | null;
  year?: number;
  km: number;
  price: number;
  sold?: boolean;
  transmission?: string | null;
};

const fold = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function formatCardKm(
  vehicle: CardFormatterVehicle,
  opts: { compact?: boolean } = {},
) {
  if (vehicle.km >= 10_000) {
    const mil = `${Math.round(vehicle.km / 1000)} mil`;
    return opts.compact ? mil : `${mil} km`;
  }
  return formatKmBR(vehicle.km);
}

function formatCardGear(vehicle: CardFormatterVehicle) {
  const raw = vehicle.transmission?.trim();
  if (!raw) return null;
  const folded = fold(raw);
  if (/cvt/.test(folded) && !/automatic/.test(folded)) return "CVT";
  if (/automatic|cvt/.test(folded)) return "Auto";
  if (/manual/.test(folded)) return "Manual";
  return raw;
}

function formatCardMeta(vehicle: CardFormatterVehicle) {
  const gear = formatCardGear(vehicle);
  return [
    vehicle.year ? String(vehicle.year) : "",
    formatCardKm(vehicle, { compact: Boolean(gear) }),
    gear,
  ]
    .filter((item): item is string => Boolean(item && item !== "0"))
    .join(" · ");
}

function formatCardPrice(vehicle: CardFormatterVehicle) {
  return vehicle.sold ? "Vendido" : formatCurrencyBRL(vehicle.price);
}

function formatCardVersion(vehicle: CardFormatterVehicle) {
  const version = shortVersion(vehicle.version, vehicle.model);
  return version || null;
}

function formatCardLabel(vehicle: CardFormatterVehicle) {
  const version = shortVersion(vehicle.version, vehicle.model);
  return `${vehicle.title ?? ""}${version ? ` ${version}` : ""} ${vehicle.year ?? ""}`.trim();
}

export const CARD_FORMATTERS = {
  km: formatCardKm,
  gear: formatCardGear,
  meta: formatCardMeta,
  price: formatCardPrice,
  version: formatCardVersion,
  label: formatCardLabel,
} as const;
