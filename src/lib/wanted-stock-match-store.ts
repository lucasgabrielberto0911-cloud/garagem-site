import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { ADMIN_DATA_TAG, ADMIN_NEW_LEADS_TAG } from "./admin-cache";
import { WANTED_LEAD_SOURCE } from "./leads";
import { formatCurrencyBRL } from "./format";
import { vehiclePath } from "./vehicle-slug";
import {
  MATCH_DISMISSED_ACTION,
  matchPreparationWhatsApp,
  matchWhatsApp,
  wantedPreparationMatch,
  wantedStockMatch,
  type MatchLead,
  type MatchPreparationVehicle,
  type MatchVehicle,
} from "./wanted-stock-match";

/** Mesma normalização dos termos em wantedStockMatch; o filtro definitivo continua lá. */
function matchWords(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/([a-z])-([a-z])/g, "$1$2").match(/[a-z]+|\d+/g) ?? [];
}

export type WantedStockMatchItem = {
  id: string;
  leadId: string;
  vehicleId: string;
  title: string;
  detail: string;
  criteria: string;
  href: string;
  vehicleHref?: string;
  whatsappHref: string | null;
};

export function buildWantedStockMatches(
  leads: MatchLead[],
  vehicles: MatchVehicle[],
  preparations: MatchPreparationVehicle[],
  dismissed: Set<string>,
): WantedStockMatchItem[] {
  if (!leads.length || (!vehicles.length && !preparations.length)) return [];
  // Todo match exige a primeira palavra do modelo no pedido. Preparar uma vez
  // evita normalizar modelos e avaliar faixas em cada par incompatível.
  const vehicleAnchors = vehicles.map(vehicle => matchWords(vehicle.model)[0] ?? "");
  const prepAnchors = preparations.map(prep => matchWords(prep.model)[0] ?? "");
  return leads.flatMap(lead => {
    const requestWords = new Set(matchWords(lead.vehicleInfo));
    const stockMatches: WantedStockMatchItem[] = vehicles.flatMap((vehicle, index) => {
      if (!requestWords.has(vehicleAnchors[index])) return [];
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
    });
    const prepMatches: WantedStockMatchItem[] = preparations.flatMap((prep, index) => {
      if (!requestWords.has(prepAnchors[index])) return [];
      const id = lead.id + ":" + prep.id;
      if (dismissed.has(id)) return [];
      const criteria = wantedPreparationMatch(lead, prep);
      if (!criteria) return [];
      return [{
        id, leadId: lead.id, vehicleId: prep.id, title: lead.name,
        detail: ["Em preparação", prep.brand, prep.model, prep.color, prep.year, prep.ready ? "Pronto para anunciar" : "Em preparo"].filter(Boolean).join(" · "),
        criteria: criteria.join(", "), href: "/admin/leads?lead=" + encodeURIComponent(lead.id),
        whatsappHref: matchPreparationWhatsApp(lead, prep),
      }];
    });
    return [...stockMatches, ...prepMatches];
  });
}

export async function loadWantedStockMatches() {
  const [leads, vehicles, preparations] = await Promise.all([
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
    prisma.preparationVehicle.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, brand: true, model: true, color: true, year: true, km: true, ready: true, posted: true },
    }),
  ]);
  if (!leads.length || (!vehicles.length && !preparations.length)) return [];
  const ignored = await prisma.adminAudit.findMany({
    where: { action: MATCH_DISMISSED_ACTION, entityId: { in: leads.map(lead => lead.id) } },
    select: { entityId: true, changes: true },
  });
  const dismissed = new Set(ignored.flatMap(item => {
    const changes = item.changes as { vehicleId?: unknown } | null;
    return typeof changes?.vehicleId === "string" ? [item.entityId + ":" + changes.vehicleId] : [];
  }));
  return buildWantedStockMatches(leads, vehicles, preparations, dismissed);
}

export const getWantedStockMatches = unstable_cache(loadWantedStockMatches, ["wanted-stock-matches-v1"], {
  revalidate: 60, tags: [ADMIN_DATA_TAG, ADMIN_NEW_LEADS_TAG],
});
