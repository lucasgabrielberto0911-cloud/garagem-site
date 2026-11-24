/**
 * Critério único do estoque público: só o que o visitante consegue abrir
 * na listagem. Sitemap, ISR e redirects de anúncio morto usam isto.
 */
export const PUBLIC_STOCK_STATUS = "disponivel" as const;

export const AWAITING_DELIVERY_STATUS = "aguardando_entrega" as const;
export const AWAITING_DELIVERY_LABEL = "Vendido, aguardando entrega" as const;
export const PUBLIC_LISTING_STATUSES = [
  PUBLIC_STOCK_STATUS,
  AWAITING_DELIVERY_STATUS,
] as const;

export type PublicStockStatus = typeof PUBLIC_STOCK_STATUS;

export type PublicStockVehicle = {
  status?: string | null;
  historical?: boolean | null;
};

export function isPublicStockVehicle(vehicle: PublicStockVehicle) {
  return (
    vehicle.status === PUBLIC_STOCK_STATUS && vehicle.historical !== true
  );
}

export function isAwaitingDeliveryStatus(status?: string | null) {
  return status === AWAITING_DELIVERY_STATUS;
}

export function isSoldOrAwaitingDelivery(status?: string | null) {
  return status === "vendido" || status === AWAITING_DELIVERY_STATUS;
}

export const PUBLIC_SITEMAP_VEHICLE_WHERE = {
  status: PUBLIC_STOCK_STATUS,
  historical: false,
} as const;

export const PUBLIC_LISTING_VEHICLE_WHERE: {
  status: { in: string[] };
  historical: false;
} = {
  status: { in: [...PUBLIC_LISTING_STATUSES] },
  historical: false,
};

/**
 * Campos mínimos do card de listagem. Isolado para rotas públicas
 * (`/api/veiculos`) não puxarem o módulo admin/depoimentos.
 */
export const PUBLIC_VEHICLE_CARD_SELECT = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  km: true,
  price: true,
  transmission: true,
  fuel: true,
  status: true,
  featured: true,
  color: true,
  createdAt: true,
  updatedAt: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
} as const;
