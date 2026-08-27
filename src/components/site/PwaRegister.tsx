"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let idleId = 0;
    let timeoutId = 0;
    let registered = false;

    function register() {
      if (registered) return;
      registered = true;
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    function onLoad() {
      const ric = window.requestIdleCallback;
      if (typeof ric === "function") {
        idleId = ric(register, { timeout: 8000 });
      } else {
        timeoutId = window.setTimeout(register, 4000);
      }
    }

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      timeoutId = window.setTimeout(register, 10000);
    }

    return () => {
      window.removeEventListener("load", onLoad);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
