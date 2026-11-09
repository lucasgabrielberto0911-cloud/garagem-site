import type { StockFilters, VehicleCardRecord } from "./stock-query";

/** Motos entram por filtro ou pedido explícito na busca. */
export function customerStockCategory(filters: Pick<StockFilters, "category" | "q">) {
  if (filters.category === "moto") return "moto";
  if (filters.category === "carro") return "carro";
  return /\b(motos?|motocicletas?)\b/i.test(filters.q ?? "") ? "moto" : "carro";
}

/** Cinco fotos é o mínimo da galeria completa; recência é a data do cadastro. */
export function orderCustomerStock<T extends Pick<VehicleCardRecord, "id" | "createdAt" | "status" | "photos" | "photoCount">>(vehicles: T[]): T[] {
  const status = (v: T) => v.status === "disponivel" ? 0 : v.status === "reservado" ? 1 : 2;
  const complete = (v: T) => Boolean(v.photos[0]?.url) && (v.photoCount ?? v.photos.length) >= 5;
  return [...vehicles].sort((a, b) =>
    status(a) - status(b) || Number(complete(b)) - Number(complete(a)) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id),
  );
}
