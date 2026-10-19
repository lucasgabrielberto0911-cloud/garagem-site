"use client";

import { useEffect, useState } from "react";
import { BrandSplash } from "@/components/site/BrandSplash";

/** Splash do app instalado, carregado com os extras após ocioso. */
export function BootSplash() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("garagem_splash") === "1";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (!forced && !standalone) return;
    try {
      if (!forced && sessionStorage.getItem("garagem:booted") === "1") return;
      sessionStorage.setItem("garagem:booted", "1");
    } catch { /* armazenamento indisponível */ }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = window.setTimeout(() => setVisible(true), 0);
    const hide = window.setTimeout(() => setVisible(false), forced ? 1200 : reduced ? 120 : 280);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, []);
  return visible ? <div className="fixed inset-0 z-[100] bg-asphalt" aria-hidden="true"><BrandSplash /></div> : null;
}
