/**
 * Critério único do estoque público: só o que o visitante consegue abrir
 * na listagem. Sitemap, ISR e redirects de anúncio morto usam isto.
 */
export const PUBLIC_STOCK_STATUS = "disponivel" as const;

export type PublicStockVehicle = {
  status?: string | null;
  historical?: boolean | null;
};

export function isPublicStockVehicle(vehicle: PublicStockVehicle) {
  return (
    vehicle.status === PUBLIC_STOCK_STATUS && vehicle.historical !== true
  );
}

export const PUBLIC_SITEMAP_VEHICLE_WHERE = {
  status: PUBLIC_STOCK_STATUS,
  historical: false,
} as const;

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
  updatedAt: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
} as const;
