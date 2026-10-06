import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { ADMIN_DATA_TAG, ADMIN_NEW_LEADS_TAG } from "./admin-cache";
import { WANTED_LEAD_SOURCE } from "./leads";
import { formatCurrencyBRL } from "./format";
import { vehiclePath } from "./vehicle-slug";
import { MATCH_DISMISSED_ACTION, matchWhatsApp, wantedStockMatch } from "./wanted-stock-match";

export async function loadWantedStockMatches() {
  const [leads, vehicles] = await Promise.all([
    prisma.leadVenda.findMany({
      where: { source: WANTED_LEAD_SOURCE, status: { notIn: ["fechado", "perdido"] } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, name: true, phone: true, vehicleInfo: true, notes: true, source: true, status: true },
    }),
    prisma.vehicle.findMany({
      where: { status: "disponivel", historical: false },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, brand: true, model: true, version: true, yearModel: true, price: true, km: true, transmission: true, status: true, historical: true },
    }),
  ]);
  if (!leads.length || !vehicles.length) return [];
  const ignored = await prisma.adminAudit.findMany({
    where: { action: MATCH_DISMISSED_ACTION, entityId: { in: leads.map(lead => lead.id) } },
    select: { entityId: true, changes: true },
  });
  const dismissed = new Set(ignored.flatMap(item => {
    const changes = item.changes as { vehicleId?: unknown } | null;
    return typeof changes?.vehicleId === "string" ? [item.entityId + ":" + changes.vehicleId] : [];
  }));
  return leads.flatMap(lead => vehicles.flatMap(vehicle => {
    const id = lead.id + ":" + vehicle.id;
    if (dismissed.has(id)) return [];
    const criteria = wantedStockMatch(lead, vehicle);
    if (!criteria) return [];
    return [{
      id, leadId: lead.id, vehicleId: vehicle.id, title: lead.name,
      detail: [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel, Number.isFinite(vehicle.price) && vehicle.price > 0 ? formatCurrencyBRL(vehicle.price) : null].filter(Boolean).join(" · "),
      criteria: criteria.join(", "), href: "/admin/leads?lead=" + encodeURIComponent(lead.id),
      vehicleHref: vehiclePath(vehicle), whatsappHref: matchWhatsApp(lead, vehicle),
    }];
  }));
}

export const getWantedStockMatches = unstable_cache(loadWantedStockMatches, ["wanted-stock-matches-v1"], {
  revalidate: 60, tags: [ADMIN_DATA_TAG, ADMIN_NEW_LEADS_TAG],
});
