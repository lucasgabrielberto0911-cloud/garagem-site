import { isLeadOrigin } from "./lead-origin";
/** Pedido de quem não achou o modelo no estoque ou na ficha. Mesma tabela dos outros leads. */
export const WANTED_LEAD_SOURCE = "nao-encontrou";

export const LEAD_STATUSES = [
  "novo",
  "contatado",
  "conversa",
  "visita-marcada",
  "visitou",
  "avaliado",
  "negociando",
  "fechado",
  "perdido",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  conversa: "Conversa",
  "visita-marcada": "Visita marcada",
  visitou: "Visitou",
  avaliado: "Avaliado",
  negociando: "Negociando",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const LEAD_STATUS_STYLE: Record<LeadStatus, string> = {
  novo: "bg-brand/15 text-brand",
  conversa: "bg-brand/15 text-brand",
  "visita-marcada": "bg-brand-orange/15 text-brand-orange",
  visitou: "bg-brand-yellow/15 text-brand-yellow",
  contatado: "bg-brand-orange/15 text-brand-orange",
  avaliado: "bg-brand-yellow/15 text-brand-yellow",
  negociando: "bg-white/10 text-cream",
  fechado: "bg-emerald-500/15 text-emerald-400",
  perdido: "bg-white/5 text-muted",
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function buildLeadWhatsAppUrl(lead: {
  phone: string;
  name: string;
  vehicleInfo?: string | null;
  plate?: string | null;
  source?: string | null;
}): string {
  const digits = lead.phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const firstName = lead.name.trim().split(/\s+/)[0] || "cliente";
  let text = "";
  if (lead.source === "chatbot-site") {
    const topic = lead.vehicleInfo ? ` sobre o ${lead.vehicleInfo}` : "";
    text = `Olá, ${firstName}! Aqui é da Garagem. Você conversou com nosso assistente virtual no site${topic}. Como posso te ajudar?`;
  } else if (lead.source === WANTED_LEAD_SOURCE) {
    const model = lead.vehicleInfo?.trim();
    const about = model ? ` quando chegar um ${model}` : "";
    text = `Olá, ${firstName}! Aqui é da Garagem. Você pediu para ser avisado${about}. Posso te ajudar?`;
  } else if (lead.source?.startsWith("whatsapp:")) {
    text = `Olá, ${firstName}! Aqui é da Garagem. Vamos continuar nossa conversa${lead.vehicleInfo ? ` sobre o ${lead.vehicleInfo}` : ""}?`;
  } else {
    const plateClean = (lead.plate ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const plateLabel = plateClean ? ` (placa ${plateClean})` : "";
    const vehicle = lead.vehicleInfo ? ` do ${lead.vehicleInfo}` : "";
    text = `Olá, ${firstName}! Aqui é da Garagem. Recebemos sua solicitação de avaliação${vehicle}${plateLabel}.`;
  }
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

/** Conversa registrada só com telefone (ou só com nome) ainda aparece com rótulo legível. */
export function leadDisplayName(lead: { name: string; phone?: string | null }) {
  return lead.name.trim() || "Sem nome";
}
export function leadHasPhone(lead: { phone: string }) {
  return lead.phone.replace(/\D/g, "").length >= 10;
}

export function isLeadSource(value: string) {
  return ["vender", "chatbot-site", WANTED_LEAD_SOURCE].includes(value) ||
    (value.startsWith("whatsapp:") && isLeadOrigin(value.slice("whatsapp:".length)));
}
