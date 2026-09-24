"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SITE_CHAT_OPEN_EVENT } from "@/lib/chat-open";
import { isVehicleFichaPath } from "@/lib/site";

const SiteChat = dynamic(
  () => import("@/components/site/SiteChat").then((mod) => mod.SiteChat),
  { ssr: false },
);

/**
 * O chat não entra no JS da primeira dobra. Na ficha o FAB já fica
 * escondido; o bundle só baixa depois do load, ou na hora se alguém
 * tocar em Ajuda (o pedido fica em window até o chat montar).
 */
export function DeferredSiteChat() {
  const pathname = usePathname() || "/";
  const onFicha = isVehicleFichaPath(pathname);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    let idleId = 0;

    const arm = () => {
      if (!cancelled) setReady(true);
    };

    window.addEventListener(SITE_CHAT_OPEN_EVENT, arm);

    if (onFicha) {
      const start = () => {
        timeoutId = window.setTimeout(arm, 2000);
      };
      if (document.readyState === "complete") start();
      else window.addEventListener("load", start, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener(SITE_CHAT_OPEN_EVENT, arm);
        window.removeEventListener("load", start);
        window.clearTimeout(timeoutId);
      };
    }

    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(arm, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(arm, 1500);
    }

    return () => {
      cancelled = true;
      window.removeEventListener(SITE_CHAT_OPEN_EVENT, arm);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [onFicha]);

  if (!ready) return null;
  return <SiteChat />;
}
