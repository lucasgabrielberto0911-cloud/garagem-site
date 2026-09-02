import { IconWhatsApp } from "@/components/site/icons";
import { whatsappUrl } from "@/lib/site";

/**
 * Float só no desktop — no mobile o WhatsApp já está na bottom nav.
 * Some na ficha via CSS (`body:has([data-vehicle-mobile-bar])`).
 */
export function WhatsAppFloat() {
  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir WhatsApp"
      className="whatsapp-float fixed bottom-6 right-6 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 active:scale-95 touch-manipulation lg:flex"
    >
      <IconWhatsApp className="h-7 w-7" />
    </a>
  );
}
