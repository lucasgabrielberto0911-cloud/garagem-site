"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getChatVehicleContext,
  subscribeChatVehicleContext,
} from "@/lib/chat-vehicle-context";
import { pageWhatsAppHref } from "@/lib/whatsapp-cta";

/**
 * wa.me do chrome global (header / float): na ficha herda o veículo
 * (`utm_campaign=ficha` + `utm_content`); no resto, a campanha da rota.
 */
export function usePageWhatsAppHref(message?: string) {
  const pathname = usePathname() || "/";
  const [vehicle, setVehicle] = useState(getChatVehicleContext);

  useEffect(() => subscribeChatVehicleContext(setVehicle), []);

  return pageWhatsAppHref({ pathname, vehicle, message });
}
