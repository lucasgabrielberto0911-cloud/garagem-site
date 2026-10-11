"use client";
import { useEffect } from "react";
import { CONSENT_EVENT, hasMarketingConsent } from "@/lib/consent";
import { applyWhatsAppOrigin, classifyLeadOrigin, isLeadOrigin, type LeadOrigin } from "@/lib/lead-origin";
const KEY = "garagem_primeira_origem";
/** Captura no layout raiz, que permanece entre home/estoque/ficha. Nenhuma requisição extra. */
export function WhatsAppOrigin() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const landing = classifyLeadOrigin(window.location.search, document.referrer, window.location.origin);
    let origin: LeadOrigin | null = null;
    function sync() {
      if (!hasMarketingConsent()) {
        origin = null;
        try { sessionStorage.removeItem(KEY); } catch { /* armazenamento indisponível */ }
        return;
      }
      try {
        const stored = sessionStorage.getItem(KEY);
        origin = isLeadOrigin(stored) ? stored : landing;
        sessionStorage.setItem(KEY, origin);
      } catch { origin = landing; }
    }
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    function enrich(event: Event) {
      if (window.location.pathname.startsWith("/admin")) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      // Compartilhamentos bare e contatos do admin ficam fora. Ponto comum também para futuros CTAs.
      if (!(target instanceof HTMLAnchorElement) || !/[?&]utm_source=site(?:&|$)/.test(target.href)) return;
      sync();
      target.href = applyWhatsAppOrigin(target.href, origin);
    }
    document.addEventListener("click", enrich, true);
    document.addEventListener("auxclick", enrich, true);
    document.addEventListener("contextmenu", enrich, true);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
      document.removeEventListener("click", enrich, true);
      document.removeEventListener("auxclick", enrich, true);
      document.removeEventListener("contextmenu", enrich, true);
    };
  }, []);
  return null;
}
