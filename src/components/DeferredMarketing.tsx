"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Marketing, extras e telemetria só baixam depois da primeira interação
 * ou de um idle longo — o import estático puxava esses chunks no LCP.
 * O service worker registra no layout (PwaRegister), não aqui.
 * O Meta Pixel fica no layout (stub imediato + fbevents lazy) para
 * ViewContent da ficha não se perder antes do idle.
 */
export function DeferredMarketing() {
  const [slot, setSlot] = useState<ReactNode>(null);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let idleId = 0;
    let timeoutId = 0;

    function cleanup() {
      window.removeEventListener("pointerdown", load);
      window.removeEventListener("keydown", load);
      window.removeEventListener("scroll", load);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    }

    function load() {
      if (started || cancelled) return;
      started = true;
      cleanup();
      void Promise.all([
        import("@/components/GoogleAnalytics"),
        import("@vercel/analytics/next"),
        import("@vercel/speed-insights/next"),
        import("@/components/site/SiteExtras"),
      ]).then(
        ([
          { GoogleAnalytics },
          { Analytics },
          { SpeedInsights },
          { SiteExtras },
        ]) => {
          if (cancelled) return;
          setSlot(
            <>
              <GoogleAnalytics />
              <Analytics />
              <SpeedInsights />
              <SiteExtras />
            </>,
          );
        },
      );
    }

    window.addEventListener("pointerdown", load, { once: true, passive: true });
    window.addEventListener("keydown", load, { once: true });
    window.addEventListener("scroll", load, { once: true, passive: true });

    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(() => {
        timeoutId = window.setTimeout(load, 1500);
      }, { timeout: 6000 });
    } else {
      timeoutId = window.setTimeout(load, 8000);
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return slot;
}
