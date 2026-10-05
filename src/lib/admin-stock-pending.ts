import type { Prisma } from "@prisma/client";
import { staleCutoffDate } from "@/lib/stock-quality";

export type StockPending = "sem-fotos" | "antigos" | "";
export function parseStockPending(value?: string | null): StockPending {
  return value === "sem-fotos" || value === "antigos" ? value : "";
}
export function stockPendingWhere(pending: StockPending): Prisma.VehicleWhereInput {
  if (pending === "sem-fotos") return { photos: { none: {} } };
  if (pending === "antigos") return { status: "disponivel", createdAt: { lt: staleCutoffDate() } };
  return {};
}
