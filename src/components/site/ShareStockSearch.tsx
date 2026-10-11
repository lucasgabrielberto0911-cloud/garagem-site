"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconShare } from "./icons";
import { shareVehicleLink } from "@/lib/vehicle-share";
import { stockShareUrl } from "@/lib/stock-share";
import { site } from "@/lib/site";

export function ShareStockSearch({ className = "", icon }: { className?: string; icon?: ReactNode }) {
  const [status, setStatus] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);

  function finish(next: typeof status) {
    if (!mounted.current) return;
    if (timer.current) clearTimeout(timer.current);
    setStatus(next);
    if (next !== "failed") timer.current = setTimeout(() => setStatus("idle"), 2400);
  }

  async function share(copyOnly = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const url = stockShareUrl(site.url, window.location.search);
      const result = await shareVehicleLink(copyOnly ? { clipboard: navigator.clipboard } : navigator, {
        title: "Busca de veículos — Garagem",
        text: "Veja esta busca de seminovos na Garagem.", url,
      });
      finish(result === "cancelled" ? "idle" : result);
    } catch { finish("failed"); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }

  const buttonClass = `inline-flex min-h-11 items-center justify-center gap-1.5 border border-white/15 px-3 text-xs font-semibold text-cream transition hover:border-brand hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60 ${className}`;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2" data-share-stock-search="">
      <button type="button" onClick={() => void share()} disabled={busy} aria-busy={busy}
        className={buttonClass} aria-label="Compartilhar esta busca de veículos">
        {icon ?? <IconShare className="h-4 w-4" />}
        {status === "copied" ? "Link copiado" : status === "shared" ? "Busca compartilhada" : "Compartilhar busca"}
      </button>
      {status === "failed" ? (
        <>
          <button type="button" onClick={() => void share(true)} disabled={busy} className={buttonClass}>Copiar link da busca</button>
          <span role="status" className="basis-full text-xs text-muted">Não foi possível compartilhar. Tente copiar o link.</span>
        </>
      ) : <span role="status" className="sr-only">{status === "copied" ? "Link da busca copiado" : status === "shared" ? "Busca compartilhada" : ""}</span>}
    </span>
  );
}
