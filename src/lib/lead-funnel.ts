import { localDateInput } from "./admin-date";
import { purchaseSourceLabel } from "./lead-origin";
export const PURCHASE_STATUSES = ["conversa", "visita-marcada", "visitou", "fechado", "perdido"] as const;
export const PURCHASE_STATUS_LABEL = { conversa: "Conversa", "visita-marcada": "Visita marcada", visitou: "Visitou", fechado: "Vendeu", perdido: "Perdeu" };
export function funnelActivity(status: string) { return `[funil:${status}]`; }
/** Coorte da semana corrente, segunda a domingo, no horário da loja. */
export function leadWeekStart(now = new Date()) {
  const start = new Date(`${localDateInput(now)}T00:00:00-03:00`);
  const weekday = new Date(`${localDateInput(now)}T12:00:00Z`).getUTCDay();
  return new Date(start.getTime() - ((weekday + 6) % 7) * 86400000);
}
type FunnelLead = {
  createdAt: Date; status: string; source: string | null; interestVehicleId: string | null;
  vehicleInfo: string; activities: { note: string }[];
};
export type FunnelCounts = { label: string; conversas: number; marcadas: number; visitas: number; vendas: number };
export function weeklyLeadSummary(leads: FunnelLead[], now = new Date()) {
  const cars = new Map<string, FunnelCounts>();
  const sources = new Map<string, FunnelCounts>();
  const start = leadWeekStart(now);
  for (const lead of leads) {
    if (!lead.source?.startsWith("whatsapp:") || lead.createdAt < start || lead.createdAt > now) continue;
    const stages = new Set([lead.status, ...lead.activities.flatMap(({ note }) => {
      const stage = /^\[funil:([^\]]+)\]/.exec(note)?.[1];
      return stage ? [stage] : [];
    })]);
    const vehicle = lead.vehicleInfo || "Sem veículo definido";
    for (const [map, key, label] of [
      [cars, lead.interestVehicleId || vehicle, vehicle],
      [sources, lead.source, purchaseSourceLabel(lead.source)],
    ] as const) {
      const counts = map.get(key) || { label, conversas: 0, marcadas: 0, visitas: 0, vendas: 0 };
      counts.conversas++;
      if (stages.has("visita-marcada")) counts.marcadas++;
      if (stages.has("visitou")) counts.visitas++;
      if (stages.has("fechado")) counts.vendas++;
      map.set(key, counts);
    }
  }
  const sorted = (map: Map<string, FunnelCounts>) => [...map.values()].sort((a, b) => b.conversas - a.conversas || a.label.localeCompare(b.label));
  return { cars: sorted(cars), sources: sorted(sources) };
}
