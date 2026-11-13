"use client";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";
import { usePathname } from "next/navigation";
import { recordSiteFunnel } from "@/lib/site-funnel-client";
import { useCallback, useEffect, useRef } from "react";
import { CONSENT_EVENT, hasMarketingConsent } from "@/lib/consent";
import { classifyLeadOrigin, isLeadOrigin, type LeadOrigin } from "@/lib/lead-origin";
import { enrichWhatsAppAnchor, enrichWhatsAppAnchors } from "@/lib/whatsapp-origin-dom";
const KEY = "garagem_primeira_origem";
/** Captura no layout raiz, que permanece entre home/estoque/ficha. Enriquece links sem dados pessoais. */
export function WhatsAppOrigin() {
  const pathname = usePathname();
  const landingRef = useRef<LeadOrigin | null>(null);

  const readAndSyncOrigin = useCallback((): LeadOrigin | null => {
    if (typeof window === "undefined" || window.location.pathname.startsWith("/admin")) return null;
    if (!hasMarketingConsent()) {
      try { sessionStorage.removeItem(KEY); } catch { /* armazenamento indisponível */ }
      return null;
    }
    const landing =
      landingRef.current ??
      classifyLeadOrigin(window.location.search, document.referrer, window.location.origin);
    landingRef.current = landing;
    try {
      const stored = sessionStorage.getItem(KEY);
      const origin = isLeadOrigin(stored) ? stored : landing;
      sessionStorage.setItem(KEY, origin);
      return origin;
    } catch {
      return landing;
    }
  }, []);

  const syncAllLinks = useCallback(() => {
    if (typeof document === "undefined" || window.location.pathname.startsWith("/admin")) return;
    const origin = readAndSyncOrigin();
    enrichWhatsAppAnchors(document.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me"]'), origin);
  }, [readAndSyncOrigin]);

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
    syncAllLinks();
    window.addEventListener(CONSENT_EVENT, syncAllLinks);
    window.addEventListener("storage", syncAllLinks);
    function enrich(event: Event) {
      if (window.location.pathname.startsWith("/admin")) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const origin = readAndSyncOrigin();
      enrichWhatsAppAnchor(target, origin);
    }
    document.addEventListener("click", enrich, true);
    document.addEventListener("auxclick", enrich, true);
    document.addEventListener("contextmenu", enrich, true);
    document.addEventListener("pointerdown", enrich, true);
    document.addEventListener("focusin", enrich, true);
    document.documentElement.dataset.whatsappOriginReady = "1";
    return () => {
      delete document.documentElement.dataset.whatsappOriginReady;
      window.removeEventListener(CONSENT_EVENT, syncAllLinks);
      window.removeEventListener("storage", syncAllLinks);
      document.removeEventListener("click", enrich, true);
      document.removeEventListener("auxclick", enrich, true);
      document.removeEventListener("contextmenu", enrich, true);
      document.removeEventListener("pointerdown", enrich, true);
      document.removeEventListener("focusin", enrich, true);
    };
  }, [readAndSyncOrigin, syncAllLinks]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    syncAllLinks();
    const raf = window.requestAnimationFrame(() => syncAllLinks());
    return () => window.cancelAnimationFrame(raf);
  }, [pathname, syncAllLinks]);

  return null;
}
