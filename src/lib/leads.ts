export const LEAD_STATUSES = [
  "novo",
  "contatado",
  "avaliado",
  "negociando",
  "fechado",
  "perdido",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  avaliado: "Avaliado",
  negociando: "Negociando",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const LEAD_STATUS_STYLE: Record<LeadStatus, string> = {
  novo: "bg-brand/15 text-brand",
  contatado: "bg-brand-orange/15 text-brand-orange",
  avaliado: "bg-brand-yellow/15 text-brand-yellow",
  negociando: "bg-white/10 text-cream",
  fechado: "bg-emerald-500/15 text-emerald-400",
  perdido: "bg-white/5 text-muted",
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}
