"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MetaPixel } from "@/components/MetaPixel";

/**
 * GA e Meta só entram depois da primeira interação ou de um idle longo,
 * para não disputar CPU/rede com o LCP no celular.
 */
export function DeferredMarketing({ children }: { children?: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    let idleId = 0;
    let timeoutId = 0;

    function load() {
      setReady(true);
    }

    function onInteract() {
      load();
    }

    window.addEventListener("pointerdown", onInteract, { once: true, passive: true });
    window.addEventListener("keydown", onInteract, { once: true });
    window.addEventListener("scroll", onInteract, { once: true, passive: true });

    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(() => {
        timeoutId = window.setTimeout(load, 1500);
      }, { timeout: 6000 });
    } else {
      timeoutId = window.setTimeout(load, 8000);
    }

    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("scroll", onInteract);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [ready]);

  if (!ready) return children ?? null;

  return (
    <>
      {children}
      <GoogleAnalytics />
      <MetaPixel />
    </>
  );
}
