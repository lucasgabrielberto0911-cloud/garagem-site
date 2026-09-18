"use client";

import { IconWhatsApp } from "@/components/site/icons";
import { usePageWhatsAppHref } from "@/components/site/usePageWhatsAppHref";
import { trackWhatsAppClick } from "@/lib/meta-pixel";

/**
 * Float só no desktop — no mobile o WhatsApp já está na bottom nav.
 * Some na ficha via CSS (`data-ficha-page` / `data-vehicle-mobile-bar`).
 * Na ficha o href herda o veículo (campanha `ficha` + `utm_content`).
 */
export function WhatsAppFloat() {
  const href = usePageWhatsAppHref();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir WhatsApp"
      onClick={() => trackWhatsAppClick("float")}
      className="whatsapp-float fixed bottom-6 right-6 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 active:scale-95 touch-manipulation lg:flex"
    >
      <IconWhatsApp className="h-7 w-7" />
    </a>
  );
}
