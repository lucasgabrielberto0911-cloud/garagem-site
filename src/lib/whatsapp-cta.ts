import type { ChatVehicleContext } from "@/lib/chat-vehicle-context";
import {
  WHATSAPP_MESSAGES,
  isVehicleFichaPath,
  pageWhatsAppTracking,
  whatsappUrl,
} from "@/lib/site";
import { formatVehicleWhatsAppMessage } from "@/lib/vehicle-display";

/** Pré-preenchido do header/float: o carro da ficha, senão o recado genérico. */
export function pageWhatsAppMessage(
  vehicle?: ChatVehicleContext | null,
): string {
  if (!vehicle || vehicle.sold) return WHATSAPP_MESSAGES.general;
  if (vehicle.brand && vehicle.model && vehicle.year) {
    return formatVehicleWhatsAppMessage({
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      yearModel: vehicle.year,
      price: vehicle.price,
      path: vehicle.path,
      isMoto: vehicle.category === "moto",
      intent: "interest",
    });
  }
  if (vehicle.label) {
    const label = vehicle.year
      ? `${vehicle.label} ${vehicle.year}`
      : vehicle.label;
    return WHATSAPP_MESSAGES.vehicle(label, vehicle.category === "moto");
  }
  return WHATSAPP_MESSAGES.general;
}

export function pageWhatsAppHref(input: {
  pathname?: string | null;
  vehicle?: ChatVehicleContext | null;
  message?: string;
}) {
  const onFicha = isVehicleFichaPath(input.pathname || "/");
  const vehicle = onFicha ? input.vehicle : null;
  return whatsappUrl(
    input.message ?? pageWhatsAppMessage(vehicle),
    pageWhatsAppTracking({
      pathname: input.pathname,
      vehicle,
    }),
  );
}
