"use client";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";
import { usePathname } from "next/navigation";
import { recordSiteFunnel } from "@/lib/site-funnel-client";
import { useEffect } from "react";
import { CONSENT_EVENT, hasMarketingConsent } from "@/lib/consent";
import { classifyLeadOrigin, isLeadOrigin, type LeadOrigin } from "@/lib/lead-origin";
import { enrichWhatsAppAnchor, enrichWhatsAppAnchors } from "@/lib/whatsapp-origin-dom";
const KEY = "garagem_primeira_origem";
const EVENTS = ["click", "auxclick", "contextmenu", "pointerdown", "focusin"] as const;
/** Captura no layout raiz, que permanece entre home/estoque/ficha. Enriquece links sem dados pessoais. */
export function WhatsAppOrigin() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let recorded = false;
    function record() {
      if (recorded || !hasMarketingConsent()) return;
      recorded = true;
      const vehicleId = pathname.startsWith("/estoque/") ? extractVehicleIdFromParam(pathname.split("/")[2]) ?? undefined : undefined;
      recordSiteFunnel("visita", vehicleId);
    }
    record();
    window.addEventListener(CONSENT_EVENT, record);
    return () => window.removeEventListener(CONSENT_EVENT, record);
  }, [pathname]);
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const landing = classifyLeadOrigin(window.location.search, document.referrer, window.location.origin);
    function readOrigin(): LeadOrigin | null {
      if (!hasMarketingConsent()) {
        try { sessionStorage.removeItem(KEY); } catch { /* armazenamento indisponível */ }
        return null;
      }
      try {
        const stored = sessionStorage.getItem(KEY);
        const origin = isLeadOrigin(stored) ? stored : landing;
        sessionStorage.setItem(KEY, origin);
        return origin;
      } catch { return landing; }
    }
    function sync() {
      if (window.location.pathname.startsWith("/admin")) return;
      enrichWhatsAppAnchors(document.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me"]'), readOrigin());
    }
    function enrich(event: Event) {
      if (window.location.pathname.startsWith("/admin")) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (target instanceof HTMLAnchorElement) enrichWhatsAppAnchor(target, readOrigin());
    }
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    for (const ev of EVENTS) document.addEventListener(ev, enrich, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    document.documentElement.dataset.whatsappOriginReady = "1";
    return () => {
      delete document.documentElement.dataset.whatsappOriginReady;
      observer.disconnect();
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
      for (const ev of EVENTS) document.removeEventListener(ev, enrich, true);
    };
  }, []);
  return null;
}
