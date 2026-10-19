import type { ChatVehicleContext } from "@/lib/chat-vehicle-context";
import {
  WHATSAPP_MESSAGES,
  formatCustomerVehicleWhatsAppText,
  isVehicleFichaPath,
  pageWhatsAppTracking,
  whatsappUrl,
} from "@/lib/site";
import { getServiceCity } from "@/lib/service-cities";
import { formatVehicleWhatsAppMessage } from "@/lib/vehicle-display";

/** Pré-preenchido do header/float: o carro da ficha, senão o recado genérico. */
export function pageWhatsAppMessage(
  vehicle?: ChatVehicleContext | null,
  pathname?: string | null,
): string {
  if (!vehicle) return cityPageMessage(pathname) ?? WHATSAPP_MESSAGES.general;
  if (vehicle.brand && vehicle.model && vehicle.year) {
    return formatVehicleWhatsAppMessage({
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      yearModel: vehicle.year,
      price: vehicle.price,
      status: vehicle.sold ? "vendido" : undefined,
      path: vehicle.path,
      isMoto: vehicle.category === "moto",
      intent: "interest",
    });
  }
  if (vehicle.sold) {
    return formatCustomerVehicleWhatsAppText({ label: vehicle.label, sold: true, isMoto: vehicle.category === "moto" });
  }
  if (vehicle.label) {
    const label = vehicle.year
      ? `${vehicle.label} ${vehicle.year}`
      : vehicle.label;
    return WHATSAPP_MESSAGES.vehicle(label, vehicle.category === "moto");
  }
  return WHATSAPP_MESSAGES.general;
}

/** Página `/seminovos/[cidade]`: o recado diz de onde o cliente veio (cidade atendida, não do veículo). */
function cityPageMessage(pathname?: string | null) {
  const slug = /^\/seminovos\/([^/?#]+)/.exec(pathname || "")?.[1];
  const city = slug ? getServiceCity(slug) : null;
  return city
    ? `Oi! Vi a página de seminovos em ${city.name} no site da Garagem e quero ver opções no estoque.`
    : null;
}

export function pageWhatsAppHref(input: {
  pathname?: string | null;
  vehicle?: ChatVehicleContext | null;
  message?: string;
}) {
  const onFicha = isVehicleFichaPath(input.pathname || "/");
  const vehicle = onFicha ? input.vehicle : null;
  return whatsappUrl(
    input.message ?? pageWhatsAppMessage(vehicle, input.pathname),
    pageWhatsAppTracking({
      pathname: input.pathname,
      vehicle,
    }),
  );
}
