"use client";

import { useEffect, useState, type ReactNode } from "react";

const QUEUE_EVENT = "garagem:offline-queue-changed";

/**
 * Adia a leitura do IndexedDB e o código de descarga offline para depois do load,
 * sem atrasar a primeira pintura; sobe na hora se a fila mudar ou a rede voltar.
 */
export function DeferredOfflineLeadFlush() {
  const [slot, setSlot] = useState<ReactNode>(null);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let idleId = 0;
    let timerId = 0;

    function cleanup() {
      window.removeEventListener("load", arm);
      window.removeEventListener("online", loadNow);
      window.removeEventListener(QUEUE_EVENT, loadNow);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timerId) window.clearTimeout(timerId);
    }

    function loadNow() {
      if (started || cancelled) return;
      started = true;
      cleanup();
      void import("@/components/site/OfflineLeadFlush").then(({ OfflineLeadFlush }) => {
        if (!cancelled) setSlot(<OfflineLeadFlush />);
      });
    }

    function arm() {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(loadNow, { timeout: 5000 });
      } else {
        timerId = window.setTimeout(loadNow, 3000);
      }
    }

    window.addEventListener("online", loadNow, { once: true });
    window.addEventListener(QUEUE_EVENT, loadNow, { once: true });
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return slot;
}
