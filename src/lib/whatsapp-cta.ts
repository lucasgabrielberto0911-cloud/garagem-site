import type { ChatVehicleContext } from "@/lib/chat-vehicle-context";
import {
  withHotLeadAlsoViewed,
  type HotLeadCarInput,
  type HotLeadViewedCar,
} from "@/lib/hot-lead";
import {
  WHATSAPP_MESSAGES,
  isVehicleFichaPath,
  pageWhatsAppTracking,
  whatsappUrl,
} from "@/lib/site";
import { getServiceCity } from "@/lib/service-cities";
import { buildWhatsAppCarMessage } from "@/lib/vehicle-display";

export { buildWhatsAppCarMessage } from "@/lib/vehicle-display";

/** Pré-preenchido do header/float: o carro da ficha, senão o recado genérico. */
export function pageWhatsAppMessage(
  vehicle?: ChatVehicleContext | null,
  pathname?: string | null,
  alsoViewed?: readonly (HotLeadViewedCar | HotLeadCarInput)[] | null,
): string {
  if (!vehicle) return cityPageMessage(pathname) ?? WHATSAPP_MESSAGES.general;
  const fallbackPath =
    vehicle.path ||
    (pathname && isVehicleFichaPath(pathname) ? pathname : undefined);
  if (
    (vehicle.brand && vehicle.model) ||
    vehicle.label ||
    vehicle.sold ||
    vehicle.status === "vendido" ||
    vehicle.status === "reservado"
  ) {
    return buildWhatsAppCarMessage({
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      label: vehicle.label,
      year: vehicle.year,
      price: vehicle.price,
      status: vehicle.sold ? "vendido" : vehicle.status,
      sold: vehicle.sold,
      path: fallbackPath,
      category: vehicle.category,
      intent: "interest",
      pageOrigin: "ficha",
      alsoViewed,
    });
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
  alsoViewed?: readonly (HotLeadViewedCar | HotLeadCarInput)[] | null;
}) {
  const onFicha = isVehicleFichaPath(input.pathname || "/");
  const vehicle = onFicha ? input.vehicle : null;
  const alsoViewed = onFicha ? input.alsoViewed : undefined;
  const resolvedMessage = input.message
    ? onFicha && alsoViewed?.length
      ? withHotLeadAlsoViewed(input.message, alsoViewed, {
          id: vehicle?.id,
          path: vehicle?.path || input.pathname,
        })
      : input.message
    : pageWhatsAppMessage(vehicle, input.pathname, alsoViewed);
  return whatsappUrl(
    resolvedMessage,
    pageWhatsAppTracking({
      pathname: input.pathname,
      vehicle,
    }),
  );
}
