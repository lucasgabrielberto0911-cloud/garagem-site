"use client";

import { useEffect } from "react";
import { shouldForceDocumentNavigation } from "@/lib/pwa-install";

const RELOAD_FLAG = "garagem:sw-reload";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(
      "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
    )
  );
}

/**
 * No app instalado registra na hora (para pegar o SW novo).
 * No navegador espera o load + idle curto, para não disputar o LCP.
 * O clique offline vira navegação completa: o App Router pede RSC, e o
 * HTML em cache só entra num carregamento de documento.
 */
export function PwaRegister() {
  useEffect(() => {
    const clearFlag = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* ignore */
      }
    }, 15000);

    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "GARAGEM_RELOAD") return;
      try {
        if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
        sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        /* ignore */
      }
      window.location.reload();
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const raw = anchor.getAttribute("href");
      if (
        !raw ||
        raw.startsWith("#") ||
        raw.startsWith("mailto:") ||
        raw.startsWith("tel:")
      ) {
        return;
      }
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const connection = (
        navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }
      ).connection;
      if (
        !shouldForceDocumentNavigation({
          online: navigator.onLine,
          saveData: connection?.saveData,
          effectiveType: connection?.effectiveType,
          pathname: url.pathname,
        })
      ) {
        return;
      }
      event.preventDefault();
      // Carregamento completo de propósito: o RSC do App Router não usa o HTML em cache.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- documento offline
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    }

    const sw = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    sw?.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);

    let idleId = 0;
    let timeoutId = 0;
    let registered = false;
    let removeLoad: (() => void) | null = null;

    function register() {
      if (registered || !sw || process.env.NODE_ENV !== "production") return;
      registered = true;
      sw.register("/sw.js").catch(() => undefined);
    }

    function scheduleRegister() {
      if (process.env.NODE_ENV !== "production" || !sw) return;
      if (isStandalone()) {
        register();
        return;
      }
      if (document.readyState === "complete") {
        const ric = window.requestIdleCallback;
        if (typeof ric === "function") {
          idleId = ric(register, { timeout: 1500 });
        } else {
          timeoutId = window.setTimeout(register, 800);
        }
        return;
      }
      const onLoad = () => {
        const ric = window.requestIdleCallback;
        if (typeof ric === "function") {
          idleId = ric(register, { timeout: 1500 });
        } else {
          register();
        }
      };
      window.addEventListener("load", onLoad, { once: true });
      removeLoad = () => window.removeEventListener("load", onLoad);
      timeoutId = window.setTimeout(register, 4000);
    }

    scheduleRegister();

    return () => {
      window.clearTimeout(clearFlag);
      sw?.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
      removeLoad?.();
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
