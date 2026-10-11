import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export const LEAD_VEHICLE_SELECT = {
  id: true, brand: true, model: true, version: true, yearModel: true, status: true,
} as const;
export function leadVehicleOption(vehicle: Prisma.VehicleGetPayload<{ select: typeof LEAD_VEHICLE_SELECT }>) {
  return { id: vehicle.id, label: [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel,
    vehicle.status === "vendido" ? "(vendido)" : ""].filter(Boolean).join(" ") };
}

/** Busca limitada; recuperar por ID inclui vendidos já escolhidos no atendimento. */
export async function findLeadVehicleOptions(options: { q?: string; id?: string; page?: number; pageSize?: number }) {
  const size = Number.isFinite(options.pageSize) ? Math.min(200, Math.max(1, Math.trunc(options.pageSize!))) : 20;
  const page = Number.isFinite(options.page) ? Math.min(1_000_000, Math.max(1, Math.trunc(options.page!))) : 1;
  const q = (options.q || "").trim().slice(0, 120);
  const items = await prisma.vehicle.findMany({
    where: options.id ? { id: options.id } : {
      historical: false, status: { in: ["disponivel", "reservado"] },
      ...(q ? { AND: q.split(/\s+/).map(term => ({
        OR: ["brand", "model", "version", "plate"].map(field => ({ [field]: { contains: term, mode: "insensitive" } })),
      })) } : {}),
    },
    select: LEAD_VEHICLE_SELECT,
    orderBy: [{ brand: "asc" }, { model: "asc" }, { id: "asc" }],
    skip: options.id ? 0 : (page - 1) * size,
    take: options.id ? 1 : size + 1,
  });
  return { items: items.slice(0, size).map(leadVehicleOption), hasMore: items.length > size };
}
