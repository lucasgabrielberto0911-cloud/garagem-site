"use client";

import type { ReactNode } from "react";
import { useHotLeadViewedCars } from "@/components/site/RememberHotLeadVehicle";
import { applyHotLeadAlsoViewed } from "@/lib/hot-lead";
import { trackWhatsAppClick, type VehicleFunnelRef } from "@/lib/meta-pixel";
import { queueWhatsAppIfOffline } from "@/lib/offline-whatsapp";

export function TrackedWhatsAppLink({
  href,
  trackingLabel,
  className,
  children,
  ariaLabel,
  vehicleId,
  slug,
  pageOrigin,
}: {
  href: string;
  trackingLabel: string;
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
  vehicleId?: string;
  slug?: string;
  pageOrigin?: string;
}) {
  const isFicha = pageOrigin === "ficha";
  const viewedCars = useHotLeadViewedCars(isFicha);
  const resolvedHref =
    isFicha && viewedCars.length > 0
      ? applyHotLeadAlsoViewed(href, viewedCars, { id: vehicleId, slug })
      : href;
  const funnel: VehicleFunnelRef | undefined =
    vehicleId || pageOrigin ? { vehicleId, slug, pageOrigin } : undefined;
  return (
    <a
      href={resolvedHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={(event) => {
        trackWhatsAppClick(trackingLabel, funnel);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          event.preventDefault();
          void queueWhatsAppIfOffline({
            url: event.currentTarget.href,
            label: trackingLabel,
            vehicleId,
          });
        }
      }}
      className={className}
    >
      {children}
    </a>
  );
}
