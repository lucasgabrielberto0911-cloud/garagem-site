import { prisma } from "@/lib/prisma";
import { isMissingTableError } from "@/lib/prisma-errors";
import { hasPriceDrop } from "@/lib/vehicle-badges";

/** Ids com queda de preço. Sem a tabela no banco, devolve vazio. */
export async function vehicleIdsWithPriceDrop(
  vehicles: { id: string; price: number }[],
): Promise<Set<string>> {
  const result = new Set<string>();
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
      if (hasPriceDrop(v.price, byVehicle.get(v.id) ?? [])) result.add(v.id);
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
) {
  try {
    const count = await prisma.vehiclePriceHistory.count({ where: { vehicleId } });
    const changed = previousPrice !== newPrice;
    if (count === 0 && changed && previousPrice && previousPrice > 0) {
      await prisma.vehiclePriceHistory.create({
        data: { vehicleId, price: previousPrice, createdAt: new Date(Date.now() - 1000) },
      });
    }
    if (count === 0 || changed) {
      await prisma.vehiclePriceHistory.create({ data: { vehicleId, price: newPrice } });
    }
  } catch (error) {
    if (!isMissingTableError(error, "VehiclePriceHistory")) {
      console.error("[price-history] falha ao registrar", error);
    }
  }
}
