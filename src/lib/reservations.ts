import { prisma } from "./prisma";

/** Usado pelo cron diário e pelo painel aberto (a cada minuto). */
export async function expireReservations() {
  return prisma.$transaction(async (tx) => {
    const due = await tx.vehicleReservation.findMany({ where: { status: "ativa", expiresAt: { lte: new Date() } }, orderBy: { vehicleId: "asc" }, take: 100, select: { id: true, vehicleId: true } });
    const ids: string[] = [];
    for (const reservation of due) {
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${reservation.vehicleId} FOR UPDATE`;
      const result = await tx.vehicleReservation.updateMany({ where: { id: reservation.id, status: "ativa", expiresAt: { lte: new Date() } }, data: { status: "expirada" } });
      if (!result.count) continue;
      const changed = await tx.vehicle.updateMany({ where: { id: reservation.vehicleId, status: "reservado", sale: { is: null } }, data: { status: "disponivel" } });
      if (changed.count) ids.push(reservation.vehicleId);
    }
    return ids;
  });
}
