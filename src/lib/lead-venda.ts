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
        | "requestId"
      >
    >,
): LeadVenda {
  return {
    ...row,
    requestId: row.requestId ?? null,
    lostReason: row.lostReason ?? null,
    nextAction: row.nextAction ?? null,
    nextActionAt: row.nextActionAt ?? null,
    interestVehicleId: row.interestVehicleId ?? null,
    source: row.source ?? null,
    photoUrls: row.photoUrls ?? [],
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

export async function createLeadVenda(data: {
  requestId?: string;
  name: string;
  phone: string;
  vehicleInfo: string;
  plate: string;
  km: number | null;
  notes: string | null;
  interestVehicleId: string | null;
  source: string | null;
  photoUrls: string[];
}) {
  try {
    return await withAdminStorageLock(async (tx) => {
      if (data.requestId) {
        const existing = await tx.leadVenda.findUnique({ where: { requestId: data.requestId }, select: { id: true } });
        if (existing) return { ...existing, replayed: true };
      }
      const lead = await tx.leadVenda.create({
        select: { id: true },
        data: {
          requestId: data.requestId,
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
      return { ...lead, replayed: false };
    });
  } catch (error) {
    if (data.requestId || !isMissingColumnError(error)) throw error;
    return prisma.leadVenda.create({
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
