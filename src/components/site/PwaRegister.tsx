"use client";

import { useEffect } from "react";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari (antes do display-mode)
    Boolean(
      "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
    )
  );
}

/**
 * No app instalado registra na hora (para pegar o SW novo).
 * No navegador espera o load + idle curto, para não disputar o LCP.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let idleId = 0;
    let timeoutId = 0;
    let registered = false;

    function onMessage(event: MessageEvent) {
      if (event.data?.type === "GARAGEM_RELOAD") {
        window.location.reload();
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage);

    function register() {
      if (registered) return;
      registered = true;
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    if (isStandalone()) {
      register();
    } else if (document.readyState === "complete") {
      const ric = window.requestIdleCallback;
      if (typeof ric === "function") {
        idleId = ric(register, { timeout: 1500 });
      } else {
        timeoutId = window.setTimeout(register, 800);
      }
    } else {
      const onLoad = () => {
        const ric = window.requestIdleCallback;
        if (typeof ric === "function") {
          idleId = ric(register, { timeout: 1500 });
        } else {
          register();
        }
      };
      window.addEventListener("load", onLoad, { once: true });
      timeoutId = window.setTimeout(register, 4000);
    }

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
