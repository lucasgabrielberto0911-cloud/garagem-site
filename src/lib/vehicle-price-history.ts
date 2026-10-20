import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMissingTableError } from "@/lib/prisma-errors";
import { priceDropAmount } from "@/lib/vehicle-badges";

/** Valor da queda por veículo (só quedas reais). Sem a tabela no banco, devolve vazio. */
export async function vehicleIdsWithPriceDrop(
  vehicles: { id: string; price: number }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (vehicles.length === 0) return result;
  try {
    const rows = await prisma.vehiclePriceHistory.findMany({
      where: { vehicleId: { in: vehicles.map((v) => v.id) } },
      select: { vehicleId: true, price: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const byVehicle = new Map<string, { price: number; createdAt: Date }[]>();
    for (const row of rows) {
      const list = byVehicle.get(row.vehicleId) ?? [];
      list.push(row);
      byVehicle.set(row.vehicleId, list);
    }
    for (const v of vehicles) {
      const amount = priceDropAmount(v.price, byVehicle.get(v.id) ?? []);
      if (amount > 0) result.set(v.id, amount);
    }
  } catch {
    // Selo é opcional: tabela ausente ou banco indisponível não pode derrubar a listagem.
  }
  return result;
}

/**
 * Registra o preço quando muda. Sem registro anterior, semeia com o preço
 * antigo (para o selo poder comparar) e depois grava o novo. Falha de tabela
 * ausente é ignorada: salvar o veículo nunca depende do histórico.
 */
export async function recordVehiclePriceChange(
  vehicleId: string,
  previousPrice: number | null | undefined,
  newPrice: number,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  try {
    const count = await db.vehiclePriceHistory.count({ where: { vehicleId } });
    const changed = previousPrice !== newPrice;
    if (count === 0 && changed && previousPrice && previousPrice > 0) {
      await db.vehiclePriceHistory.create({
        data: { vehicleId, price: previousPrice, createdAt: new Date(Date.now() - 1000) },
      });
    }
    if (count === 0 || changed) {
      await db.vehiclePriceHistory.create({ data: { vehicleId, price: newPrice } });
    }
  } catch (error) {
    if (!isMissingTableError(error, "VehiclePriceHistory")) {
      console.error("[price-history] falha ao registrar", error);
    }
  }
}
