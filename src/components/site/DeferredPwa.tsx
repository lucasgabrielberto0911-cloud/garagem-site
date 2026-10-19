"use client";
import { useEffect, useState, type ReactNode } from "react";
export function DeferredPwa() {
  const [slot, setSlot] = useState<ReactNode>(null);
  useEffect(() => {
    let cancelled = false;
    let idle = 0;
    let timer = 0;
    function load() {
      void import("@/components/site/PwaRegister").then(({ PwaRegister }) => { if (!cancelled) setSlot(<PwaRegister />); });
    }
    function arm() {
      if (window.requestIdleCallback) idle = window.requestIdleCallback(load, { timeout: 6000 });
      else timer = window.setTimeout(load, 4000);
    }
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });
    return () => { cancelled = true; window.removeEventListener("load", arm); if (idle) window.cancelIdleCallback(idle); window.clearTimeout(timer); };
  }, []);
  return slot;
}
