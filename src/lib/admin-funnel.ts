import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";
import { findWeeklyPurchaseLeads } from "@/lib/lead-venda";
import { leadWeekStart, weeklyLeadSummary } from "@/lib/lead-funnel";
import { funnelOriginLabel, mergeTrafficCounts, SITE_FUNNEL_ACTIONS, type TrafficCount } from "@/lib/site-funnel";

/** Mesmo período para eventos e conversas; cache exclusivo do painel, nunca público. */
export const getAdminTrafficFunnel = unstable_cache(async () => {
  const now = new Date();
  const start = leadWeekStart(now);
  const [events, leads] = await Promise.all([
    prisma.adminAudit.groupBy({
      by: ["adminId", "entityId", "action"],
      where: { action: { in: [...SITE_FUNNEL_ACTIONS] }, createdAt: { gte: start, lte: now } },
      _count: { _all: true },
    }),
    findWeeklyPurchaseLeads(start, now),
  ]);
  const ids = [...new Set(events.map(row => row.entityId).filter(id => id !== "site"))];
  const vehicles = ids.length ? await prisma.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true, brand: true, model: true, yearModel: true, status: true } }) : [];
  const names = new Map(vehicles.map(row => [row.id, `${row.brand} ${row.model} ${row.yearModel}`]));
  const cars = new Map<string, TrafficCount>();
  const sources = new Map<string, TrafficCount>();
  for (const event of events) {
    const origin = event.adminId.slice("site:".length);
    for (const [map, key, label] of [
      [sources, `whatsapp:${origin}`, funnelOriginLabel(origin)],
      ...(event.entityId === "site" ? [] : [[cars, event.entityId, names.get(event.entityId) || "Anúncio removido"] as const]),
    ] as const) {
      const row = map.get(key) || { key, label, acessos: 0, cliques: 0 };
      if (event.action === "site:visita") row.acessos += event._count._all;
      else row.cliques += event._count._all;
      map.set(key, row);
    }
  }
  const summary = weeklyLeadSummary(leads, now);
  const carRows = mergeTrafficCounts([...cars.values()], summary.cars);
  return { cars: carRows, sources: mergeTrafficCounts([...sources.values()], summary.sources),
    attention: carRows.filter(row => row.acessos >= 10 && row.cliques === 0 && vehicles.some(vehicle => vehicle.id === row.key && vehicle.status === "disponivel")) };
}, ["admin-traffic-funnel-v1"], { revalidate: 60, tags: [ADMIN_DATA_TAG] });
