"use client";

import { IconWhatsApp } from "@/components/site/icons";
import { usePageWhatsAppTarget } from "@/components/site/usePageWhatsAppHref";
import { SiteLeadHit } from "@/lib/funnel-events";
import { trackCatalogWhatsAppClick, trackWhatsAppClick } from "@/lib/meta-pixel";

/**
 * Float só no desktop — no mobile o WhatsApp já está na bottom nav.
 * Some na ficha via CSS (`data-ficha-page` / `data-vehicle-mobile-bar`).
 * Na ficha o href herda o veículo (campanha `ficha` + `utm_content`).
 */
export function WhatsAppFloat() {
  const whatsapp = usePageWhatsAppTarget();
  const link = (
    <a
      href={whatsapp.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      onClick={() => {
        trackWhatsAppClick("float", {
          vehicleId: whatsapp.vehicleId,
          slug: whatsapp.slug,
        });
        trackCatalogWhatsAppClick(whatsapp.catalogParams);
      }}
      className="whatsapp-float fixed bottom-6 right-6 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-asphalt shadow-lg transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt touch-manipulation lg:flex"
    >
      <IconWhatsApp className="h-7 w-7" />
    </a>
  );

  return whatsapp.catalogParams ? (
    link
  ) : (
    <SiteLeadHit contentName="WhatsApp flutuante">{link}</SiteLeadHit>
  );
}
