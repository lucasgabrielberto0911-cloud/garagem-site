import { isLeadOrigin, ORIGIN_LABELS } from "./lead-origin";
import { isVehicleCuid } from "./vehicle-slug";
import type { FunnelCounts } from "./lead-funnel";
export const SITE_FUNNEL_ACTIONS = ["site:visita", "site:whatsapp"] as const;
export function parseSiteFunnel(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if ((body.event !== "visita" && body.event !== "whatsapp") || !isLeadOrigin(body.origin)) return null;
  if (body.vehicleId !== undefined && (typeof body.vehicleId !== "string" || !isVehicleCuid(body.vehicleId))) return null;
  return { event: body.event, origin: body.origin, vehicleId: body.vehicleId as string | undefined };
}
export type TrafficCount = { key: string; label: string; acessos: number; cliques: number };
export function mergeTrafficCounts(traffic: TrafficCount[], leads: (FunnelCounts & { key: string })[]) {
  const rows = new Map(traffic.map(row => [row.key, { ...row, conversas: 0, marcadas: 0, visitas: 0, vendas: 0 }]));
  for (const lead of leads) rows.set(lead.key, { acessos: 0, cliques: 0, ...rows.get(lead.key), ...lead });
  return [...rows.values()].sort((a, b) => b.acessos - a.acessos || b.conversas - a.conversas || a.label.localeCompare(b.label, "pt-BR"));
}
export function funnelOriginLabel(key: string) { return isLeadOrigin(key) ? ORIGIN_LABELS[key] : "Origem não informada"; }
