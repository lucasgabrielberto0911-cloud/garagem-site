export type ChatVehicleContext = {
  id: string;
  label: string;
  brand: string;
  model: string;
  version?: string | null;
  year?: number;
  price?: number;
  path?: string;
  category?: string;
  status?: string;
  sold?: boolean;
  /** `true` só quando a unidade entra no catálogo da Meta (estoque próprio disponível). */
  catalog?: boolean;
};

/**
 * Contexto da ficha só entra no catálogo da Meta com `catalog === true`.
 * Contexto/snapshot antigo sem o campo (inclusive consignado) fica fora.
 */
export function chatVehicleCatalogFlag(
  vehicle: ChatVehicleContext | null | undefined,
): boolean {
  if (!vehicle?.id.trim() || vehicle.sold) return false;
  if (vehicle.status && vehicle.status !== "disponivel") return false;
  return vehicle.catalog === true;
}

let currentContext: ChatVehicleContext | null = null;
const listeners = new Set<(ctx: ChatVehicleContext | null) => void>();

export function setChatVehicleContext(ctx: ChatVehicleContext | null) {
  currentContext = ctx;
  listeners.forEach((fn) => {
    try {
      fn(ctx);
    } catch {
      // Ignora erro de listener
    }
  });
}

export function getChatVehicleContext(): ChatVehicleContext | null {
  return currentContext;
}

export function subscribeChatVehicleContext(
  fn: (ctx: ChatVehicleContext | null) => void,
) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
