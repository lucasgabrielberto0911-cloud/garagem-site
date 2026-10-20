import { adminActionDate } from "./admin-date";
import { formatCurrencyBRL } from "./format";
import { purchaseSourceLabel } from "./lead-origin";
import {
  LEAD_LOSS_REASON_LABEL,
  LEAD_STATUS_LABEL,
  WANTED_LEAD_SOURCE,
  extractLossReasonFromNote,
  isLeadLossReason,
  type LeadStatus,
} from "./leads";

export type LeadTimelineKind =
  | "criado"
  | "status"
  | "whatsapp"
  | "contato"
  | "retorno"
  | "objecao"
  | "cliente"
  | "venda"
  | "anterior";

export type LeadTimelineItem = {
  id: string;
  kind: LeadTimelineKind;
  badge: string;
  title: string;
  detail?: string;
  at: string;
};

export const TIMELINE_KIND_STYLE: Record<LeadTimelineKind, string> = {
  venda: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  cliente: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  whatsapp: "border-[#25D366]/40 bg-[#25D366]/15 text-[#25D366]",
  objecao: "border-brand/50 bg-brand/20 text-cream",
  retorno: "border-brand-orange/40 bg-brand-orange/15 text-brand-orange",
  status: "border-white/20 bg-white/10 text-cream",
  contato: "border-white/15 bg-white/5 text-cream",
  anterior: "border-brand-yellow/40 bg-brand-yellow/15 text-brand-yellow",
  criado: "border-white/10 bg-white/5 text-muted",
};

function cleanActivityText(note: string): string {
  return note
    .replace(/^\[funil:[^\]]+\]\s*/, "")
    .replace(/^\[perda:[^\]]+\]\s*/, "")
    .replace(/^\[retorno:[^\]]+\]\s*/, "")
    .trim();
}

export function classifyLeadActivity(note: string): {
  kind: LeadTimelineKind;
  badge: string;
  title: string;
} {
  const lossReason = extractLossReasonFromNote(note);
  if (lossReason) {
    return {
      kind: "objecao",
      badge: "Objeção / perda",
      title: cleanActivityText(note) || `Motivo: ${LEAD_LOSS_REASON_LABEL[lossReason]}`,
    };
  }
  const text = cleanActivityText(note);
  if (/abriu whatsapp/i.test(text)) {
    return {
      kind: "whatsapp",
      badge: "WhatsApp",
      title: text,
    };
  }
  if (/^\[retorno:/i.test(note.trim())) {
    return {
      kind: "retorno",
      badge: "Retorno",
      title: text,
    };
  }
  if (/^\[funil:/i.test(note.trim()) || /^situação atualizada para/i.test(text)) {
    return {
      kind: "status",
      badge: "Status",
      title: text,
    };
  }
  if (/^cliente cadastrado/i.test(text)) {
    return {
      kind: "cliente",
      badge: "Cliente",
      title: text,
    };
  }
  return {
    kind: "contato",
    badge: "Atendimento",
    title: text,
  };
}

function describeLeadOrigin(source?: string | null): string {
  if (!source) return "Site";
  if (source === "chatbot-site") return "Chatbot do site";
  if (source === "vender") return "Avaliação de veículo";
  if (source === WANTED_LEAD_SOURCE) return "Pedido de modelo";
  return purchaseSourceLabel(source);
}

export type BuildLeadTimelineInput = {
  lead: {
    id: string;
    createdAt: Date | string;
    source?: string | null;
    vehicleInfo: string;
    status: string;
    lostReason?: string | null;
    nextAction?: string | null;
    nextActionAt?: Date | string | null;
  };
  activities: Array<{
    id: string;
    note: string;
    createdAt: Date | string;
  }>;
  previousLeads?: Array<{
    id: string;
    createdAt: Date | string;
    vehicleInfo: string;
    status: string;
    source?: string | null;
    lostReason?: string | null;
    activities?: Array<{
      id: string;
      note: string;
      createdAt: Date | string;
    }>;
  }>;
  customer?: {
    id: string;
    name: string;
    createdAt: Date | string;
    sales?: Array<{
      id: string;
      salePrice: number;
      paymentMethod: string;
      saleDate: Date | string;
      vehicle: {
        brand: string;
        model: string;
        yearModel: number;
      };
    }>;
  } | null;
};

export function buildLeadTimeline(
  input: BuildLeadTimelineInput,
): LeadTimelineItem[] {
  const items: LeadTimelineItem[] = [];
  const { lead, activities, previousLeads = [], customer } = input;

  // 1. Entrada do lead atual
  items.push({
    id: `lead-created-${lead.id}`,
    kind: "criado",
    badge: "Entrada",
    title: `Lead recebido via ${describeLeadOrigin(lead.source)}`,
    detail: lead.vehicleInfo ? `Interesse: ${lead.vehicleInfo}` : undefined,
    at: new Date(lead.createdAt).toISOString(),
  });

  // 2. Atividades registradas neste lead
  let hasLossActivity = false;
  for (const act of activities) {
    const classified = classifyLeadActivity(act.note);
    if (classified.kind === "objecao") hasLossActivity = true;
    items.push({
      id: act.id,
      kind: classified.kind,
      badge: classified.badge,
      title: classified.title,
      at: new Date(act.createdAt).toISOString(),
    });
  }

  // Se o lead tem lostReason salvo mas não tinha atividade explícita de perda
  if (
    lead.lostReason &&
    isLeadLossReason(lead.lostReason) &&
    !hasLossActivity
  ) {
    items.push({
      id: `lead-loss-${lead.id}`,
      kind: "objecao",
      badge: "Objeção / perda",
      title: `Motivo registrado: ${LEAD_LOSS_REASON_LABEL[lead.lostReason]}`,
      at: new Date(lead.createdAt).toISOString(),
    });
  }

  // 3. Próxima ação agendada no lead atual
  if (lead.nextAction || lead.nextActionAt) {
    const scheduledDate = lead.nextActionAt ? new Date(lead.nextActionAt) : null;
    const dateLabel =
      scheduledDate && !Number.isNaN(scheduledDate.getTime())
        ? adminActionDate(scheduledDate)
        : "";
    items.push({
      id: `lead-next-${lead.id}`,
      kind: "retorno",
      badge: "Agendado",
      title: lead.nextAction || "Retomar atendimento",
      detail: dateLabel ? `Programado para ${dateLabel}` : undefined,
      at:
        scheduledDate && !Number.isNaN(scheduledDate.getTime())
          ? scheduledDate.toISOString()
          : new Date().toISOString(),
    });
  }

  // 4. Cadastro de cliente e vendas associadas ao mesmo telefone
  if (customer) {
    items.push({
      id: `customer-${customer.id}`,
      kind: "cliente",
      badge: "Cliente",
      title: `Cadastrado na base de clientes (${customer.name})`,
      at: new Date(customer.createdAt).toISOString(),
    });
    for (const sale of customer.sales ?? []) {
      items.push({
        id: `sale-${sale.id}`,
        kind: "venda",
        badge: "Venda",
        title: `Comprou ${sale.vehicle.brand} ${sale.vehicle.model} ${sale.vehicle.yearModel}`,
        detail: `${formatCurrencyBRL(sale.salePrice)} · ${sale.paymentMethod}`,
        at: new Date(sale.saleDate).toISOString(),
      });
    }
  }

  // 5. Atendimentos anteriores do mesmo cliente (quando retorna meses depois)
  for (const prev of previousLeads) {
    if (prev.id === lead.id) continue;
    const statusText =
      LEAD_STATUS_LABEL[prev.status as LeadStatus] ?? prev.status;
    const lossText =
      prev.lostReason && isLeadLossReason(prev.lostReason)
        ? ` · ${LEAD_LOSS_REASON_LABEL[prev.lostReason]}`
        : "";
    items.push({
      id: `prev-lead-${prev.id}`,
      kind: "anterior",
      badge: "Histórico do cliente",
      title: `Contato anterior: ${prev.vehicleInfo || "Sem veículo"} (${statusText}${lossText})`,
      detail: `Origem: ${describeLeadOrigin(prev.source)}`,
      at: new Date(prev.createdAt).toISOString(),
    });
    for (const act of prev.activities ?? []) {
      const classified = classifyLeadActivity(act.note);
      items.push({
        id: `prev-act-${act.id}`,
        kind: "anterior",
        badge: `Anterior · ${classified.badge}`,
        title: classified.title,
        detail: prev.vehicleInfo,
        at: new Date(act.createdAt).toISOString(),
      });
    }
  }

  // Ordena do mais recente para o mais antigo
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items;
}
