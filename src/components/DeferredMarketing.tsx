"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Extras e telemetria técnica só baixam depois da primeira interação
 * ou de um idle longo — o import estático puxava esses chunks no LCP.
 * Google Analytics e Meta Pixel ficam em MarketingScripts, após consentimento.
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
        import("@vercel/analytics/next"),
        import("@vercel/speed-insights/next"),
        import("@/components/site/SiteExtras"),
      ]).then(([{ Analytics }, { SpeedInsights }, { SiteExtras }]) => {
        if (cancelled) return;
        setSlot(
          <>
            <Analytics />
            <SpeedInsights />
            <SiteExtras />
          </>,
        );
      });
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
