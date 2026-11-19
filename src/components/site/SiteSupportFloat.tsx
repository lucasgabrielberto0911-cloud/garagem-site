"use client";

import { usePathname } from "next/navigation";
import { IconChat, IconWhatsApp } from "@/components/site/icons";
import { usePageWhatsAppTarget } from "@/components/site/usePageWhatsAppHref";
import { SiteLeadHit } from "@/lib/funnel-events";
import { trackCatalogWhatsAppClick, trackWhatsAppClick } from "@/lib/meta-pixel";

export type SiteSupportWhatsAppTarget = ReturnType<typeof usePageWhatsAppTarget>;

export function SiteSupportFloatContent({
  whatsapp,
  onOpenAssistant,
  busy = false,
  hideAssistant = false,
}: {
  whatsapp: SiteSupportWhatsAppTarget;
  onOpenAssistant: () => void;
  busy?: boolean;
  /** Na home o assistente é o botão grande do topo; só o WhatsApp flutua. */
  hideAssistant?: boolean;
}) {
  const whatsappLink = (
    <a
      data-support-whatsapp=""
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
      className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-asphalt shadow-[0_12px_28px_-8px_rgba(37,211,102,0.55),0_2px_6px_rgba(0,0,0,0.45)] transition hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt touch-manipulation"
    >
      <IconWhatsApp className="h-7 w-7" />
    </a>
  );

  return (
    <div className="pointer-events-none hidden flex-col items-end gap-2 lg:flex">
      {hideAssistant ? null : <button
        type="button"
        onClick={onOpenAssistant}
        aria-busy={busy}
        className="site-chat-launcher group pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand/50 bg-ink/95 px-4 py-2 font-display text-base font-semibold leading-none text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-brand hover:bg-brand-dark active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt touch-manipulation"
      >
        <IconChat className="h-4 w-4 shrink-0 text-brand-light transition group-hover:text-white" />
        <span>Tirar dúvida rápida</span>
      </button>}

      {whatsapp.catalogParams ? (
        whatsappLink
      ) : (
        <SiteLeadHit contentName="WhatsApp flutuante">
          {whatsappLink}
        </SiteLeadHit>
      )}
    </div>
  );
}

/**
 * Atendimento flutuante no desktop: ação primária de 1 clique no botão verde
 * do WhatsApp e pílula secundária discreta "Tirar dúvida rápida" para o assistente.
 * No celular a barra fixa assume o rodapé; na ficha `.site-chat:not(.is-open)` fica oculto via CSS.
 */
export function SiteSupportFloat({
  onOpenAssistant,
  busy = false,
}: {
  onOpenAssistant: () => void;
  busy?: boolean;
}) {
  const whatsapp = usePageWhatsAppTarget();
  const onHome = usePathname() === "/";
  return (
    <SiteSupportFloatContent
      whatsapp={whatsapp}
      hideAssistant={onHome}
      onOpenAssistant={onOpenAssistant}
      busy={busy}
    />
  );
}
