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
