import type { Prisma } from "@prisma/client";
import { staleCutoffDate } from "@/lib/stock-quality";

export type StockPending = "sem-fotos" | "sem-preco" | "antigos" | "";
export function parseStockPending(value?: string | null): StockPending {
  return value === "sem-fotos" || value === "sem-preco" || value === "antigos" ? value : "";
}
export function stockPendingWhere(pending: StockPending): Prisma.VehicleWhereInput {
  if (pending === "sem-fotos") return { photos: { none: {} } };
  if (pending === "sem-preco") return { price: { lte: 0 } };
  if (pending === "antigos") return { status: "disponivel", createdAt: { lt: staleCutoffDate() } };
  return {};
}
