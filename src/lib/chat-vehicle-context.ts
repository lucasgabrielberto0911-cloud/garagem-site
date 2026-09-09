export type ChatVehicleContext = {
  id: string;
  label: string;
  brand: string;
  model: string;
  price?: number;
  category?: string;
};

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
