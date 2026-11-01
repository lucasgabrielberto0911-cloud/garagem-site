import { withAdminStorageLock } from "@/lib/admin-storage-lock";
import type { LeadVenda, Prisma } from "@prisma/client";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";

const LEAD_CORE_SELECT = {
  id: true,
  name: true,
  phone: true,
  vehicleInfo: true,
  plate: true,
  km: true,
  notes: true,
  status: true,
  createdAt: true,
} as const;

export type LeadVendaRecord = LeadVenda;

function withLeadDefaults(
  row: Pick<
    LeadVenda,
    | "id"
    | "name"
    | "phone"
    | "vehicleInfo"
    | "plate"
    | "km"
    | "notes"
    | "status"
    | "createdAt"
  > &
    Partial<
      Pick<
        LeadVenda,
        | "interestVehicleId"
        | "source"
        | "photoUrls"
        | "updatedAt"
        | "nextAction"
        | "nextActionAt"
        | "lostReason"
      >
    >,
): LeadVenda {
  return {
    ...row,
    lostReason: row.lostReason ?? null,
    nextAction: row.nextAction ?? null,
    nextActionAt: row.nextActionAt ?? null,
    interestVehicleId: row.interestVehicleId ?? null,
    source: row.source ?? null,
    photoUrls: row.photoUrls ?? [],
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

const RECENT_REQUEST_TTL_MS = 15 * 60 * 1000;
const RECENT_CONTENT_WINDOW_MS = 2 * 60 * 1000;
const recentLeadRequests = new Map<string, { id: string; expiresAt: number }>();

export function buildSellLeadIdempotencyKey(input: {
  requestId?: string | null;
  phone: string;
  vehicleInfo: string;
  plate?: string | null;
}) {
  const reqId = input.requestId?.trim();
  if (reqId && /^[a-zA-Z0-9_-]{8,80}$/.test(reqId)) {
    return `req:${reqId}`;
  }
  const phoneDigits = input.phone.replace(/\D/g, "");
  const vehicle = input.vehicleInfo.trim().toLowerCase().replace(/\s+/g, " ");
  const plate = (input.plate ?? "").trim().toUpperCase();
  return `sig:${phoneDigits}:${vehicle}:${plate}`;
}

export function rememberLeadRequest(
  key: string,
  id: string,
  now = Date.now(),
  ttlMs = RECENT_REQUEST_TTL_MS,
) {
  for (const [k, entry] of recentLeadRequests) {
    if (entry.expiresAt <= now) recentLeadRequests.delete(k);
  }
  recentLeadRequests.set(key, { id, expiresAt: now + ttlMs });
}

export function findRememberedLeadRequest(key: string, now = Date.now()): string | null {
  const entry = recentLeadRequests.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    recentLeadRequests.delete(key);
    return null;
  }
  return entry.id;
}

export function clearLeadRequestCacheForTests() {
  recentLeadRequests.clear();
}

export async function createLeadVenda(data: {
  name: string;
  phone: string;
  vehicleInfo: string;
  plate: string;
  km: number | null;
  notes: string | null;
  interestVehicleId: string | null;
  source: string | null;
  photoUrls: string[];
  requestId?: string | null;
}): Promise<{ id: string; deduplicated?: boolean }> {
  const now = Date.now();
  const requestKey = data.requestId
    ? buildSellLeadIdempotencyKey({
        requestId: data.requestId,
        phone: data.phone,
        vehicleInfo: data.vehicleInfo,
        plate: data.plate,
      })
    : null;
  const contentKey = buildSellLeadIdempotencyKey({
    phone: data.phone,
    vehicleInfo: data.vehicleInfo,
    plate: data.plate,
  });

  const cachedId =
    (requestKey ? findRememberedLeadRequest(requestKey, now) : null) ??
    findRememberedLeadRequest(contentKey, now);
  if (cachedId) {
    return { id: cachedId, deduplicated: true };
  }

  try {
    const created = await withAdminStorageLock(async (tx) => {
      const existing = await tx.leadVenda.findFirst({
        where: {
          phone: data.phone,
          vehicleInfo: data.vehicleInfo,
          plate: data.plate,
          createdAt: { gte: new Date(now - RECENT_CONTENT_WINDOW_MS) },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return { id: existing.id, deduplicated: true };
      }
      const row = await tx.leadVenda.create({
        select: { id: true },
        data: {
          name: data.name,
          phone: data.phone,
          vehicleInfo: data.vehicleInfo,
          plate: data.plate,
          km: data.km,
          notes: data.notes,
          interestVehicleId: data.interestVehicleId,
          source: data.source,
          photoUrls: data.photoUrls,
        },
      });
      return { id: row.id, deduplicated: false };
    });
    if (requestKey) rememberLeadRequest(requestKey, created.id, now, RECENT_REQUEST_TTL_MS);
    rememberLeadRequest(contentKey, created.id, now, RECENT_CONTENT_WINDOW_MS);
    return created;
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const row = await prisma.leadVenda.create({
      select: { id: true },
      data: {
        name: data.name,
        phone: data.phone,
        vehicleInfo: data.vehicleInfo,
        plate: data.plate,
        km: data.km,
        notes: data.notes,
      },
    });
    if (requestKey) rememberLeadRequest(requestKey, row.id, now, RECENT_REQUEST_TTL_MS);
    rememberLeadRequest(contentKey, row.id, now, RECENT_CONTENT_WINDOW_MS);
    return row;
  }
}

export async function findLeadVendas(args: {
  where: Prisma.LeadVendaWhereInput;
  skip: number;
  take: number;
}) {
  try {
    const rows = await prisma.leadVenda.findMany({
      where: args.where,
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
    });
    return rows.map((row) => withLeadDefaults(row));
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const rows = await prisma.leadVenda.findMany({
      where: args.where,
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
      select: LEAD_CORE_SELECT,
    });
    return rows.map((row) => withLeadDefaults(row));
  }
}

export async function markLeadContatado(id: string) {
  try {
    await prisma.leadVenda.update({
      where: { id },
      data: { status: "contatado" },
    });
    return true;
  } catch (error) {
    console.error("[leads] falha ao marcar contatado:", error);
    return false;
  }
}

/** Coorte semanal completa, independente da paginação da lista. */
export async function findWeeklyPurchaseLeads(start: Date, end: Date) {
  return prisma.leadVenda.findMany({
    where: { source: { startsWith: "whatsapp:" }, createdAt: { gte: start, lte: end } },
    select: { createdAt: true, status: true, source: true, interestVehicleId: true, vehicleInfo: true,
      activities: { where: { note: { startsWith: "[funil:" } }, select: { note: true } } },
  });
}
