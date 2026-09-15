"use client";

import { TrackedWhatsAppLink } from "@/components/site/TrackedWhatsAppLink";
import { IconWhatsApp } from "@/components/site/icons";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

/**
 * Barra de conversão no estoque: acima da bottom nav / PWA chrome.
 * WhatsApp é o CTA principal; Simular e Troca ficam no segundo nível.
 */
export function StockMobileCtaBar() {
  const whatsappHref = whatsappUrl(WHATSAPP_MESSAGES.help);
  const financeHref = whatsappUrl(WHATSAPP_MESSAGES.finance);
  const tradeHref = whatsappUrl(WHATSAPP_MESSAGES.sell);

  return (
    <div
      data-stock-mobile-cta=""
      className="fixed inset-x-0 z-[39] border-t border-white/10 bg-asphalt/95 px-3 pt-2 backdrop-blur pl-safe pr-safe lg:hidden"
    >
      <div className="mx-auto max-w-6xl">
        <TrackedWhatsAppLink
          href={whatsappHref}
          trackingLabel="estoque-bar-whatsapp"
          className="whatsapp-btn inline-flex min-h-[48px] w-full items-center justify-center gap-2 px-4 font-display text-sm font-semibold text-white touch-manipulation"
        >
          <IconWhatsApp className="h-4 w-4" />
          Falar no WhatsApp
        </TrackedWhatsAppLink>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <TrackedWhatsAppLink
            href={financeHref}
            trackingLabel="estoque-bar-finance"
            className="inline-flex min-h-11 items-center justify-center border border-white/15 px-2 text-center font-display text-[11px] font-semibold uppercase tracking-wide text-cream touch-manipulation"
          >
            Simular
          </TrackedWhatsAppLink>
          <TrackedWhatsAppLink
            href={tradeHref}
            trackingLabel="estoque-bar-trade"
            className="inline-flex min-h-11 items-center justify-center border border-white/15 px-2 text-center font-display text-[11px] font-semibold uppercase tracking-wide text-cream touch-manipulation"
          >
            Troca
          </TrackedWhatsAppLink>
        </div>
      </div>
    </div>
  );
}
