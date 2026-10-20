"use client";
import { useEffect } from "react";
import { releaseExpiredReservations } from "@/app/admin/veiculos/commercial-actions";

export function ReservationExpiry() {
  useEffect(() => {
    let running = false;
    async function check() {
      if (document.visibilityState !== "visible" || running) return;
      running = true;
      try { await releaseExpiredReservations(); } catch { /* A próxima verificação tenta novamente. */ }
      finally { running = false; }
    }
    void check();
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);
  return null;
}
