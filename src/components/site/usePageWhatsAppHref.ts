"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getChatVehicleContext,
  subscribeChatVehicleContext,
} from "@/lib/chat-vehicle-context";
import { catalogParamsFromChatVehicle } from "@/lib/meta-pixel";
import { whatsappContentFromVehicle } from "@/lib/site";
import { pageWhatsAppHref } from "@/lib/whatsapp-cta";

/**
 * wa.me do chrome global (header / float): na ficha herda o veículo
 * (`utm_campaign=ficha` + `utm_content`); no resto, a campanha da rota.
 */
export function usePageWhatsAppTarget(message?: string) {
  const pathname = usePathname() || "/";
  const [vehicle, setVehicle] = useState(getChatVehicleContext);

  useEffect(() => subscribeChatVehicleContext(setVehicle), []);

  return {
    href: pageWhatsAppHref({ pathname, vehicle, message }),
    vehicleId: vehicle?.id,
    /** Params de catálogo (Lead/AddToCart); vendido não entra no catálogo. */
    catalogParams:
      vehicle && !vehicle.sold
        ? catalogParamsFromChatVehicle(vehicle)
        : undefined,
    slug: vehicle
      ? whatsappContentFromVehicle({ id: vehicle.id, path: vehicle.path || pathname })
      : undefined,
  };
}

export function usePageWhatsAppHref(message?: string) {
  return usePageWhatsAppTarget(message).href;
}
