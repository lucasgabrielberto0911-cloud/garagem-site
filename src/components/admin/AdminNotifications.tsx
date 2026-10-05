"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconClose } from "@/components/site/icons";
import { btn } from "@/components/admin/ui";
import { handleFocusTrap } from "@/lib/focus-trap";
import type { CostWarningsResult } from "@/lib/admin-cost-warnings";

export function AdminNotifications({ count, onCount }: { count: number | null; onCount: (count: number) => void }) {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CostWarningsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => { close(); }, [pathname, close]);
  useEffect(() => {
    if (!open) return;
    const trigger = buttonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button[aria-label='Fechar avisos']")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (dialogRef.current) handleFocusTrap(event, dialogRef.current);
    }
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", key);
      trigger?.focus();
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/admin/avisos?page=${page}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("avisos");
        const result = await response.json() as CostWarningsResult;
        if (controller.signal.aborted) return;
        setData(result);
        onCount(result.total);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, page, retry, onCount]);

  return <>
    <button ref={buttonRef} type="button" aria-label={count && count > 0 ? `Avisos: ${count} pendências` : "Avisos"}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { setPage(1); setData(null); setOpen(true); }}
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
      </svg>
      {count && count > 0 ? <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" /> : null}
    </button>
    {open ? createPortal(<div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Avisos do painel"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top,0px))] flex max-h-[calc(100dvh-6rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-xl border border-white/15 bg-ink shadow-2xl sm:right-6 sm:top-6">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
          <h2 className="font-display text-lg font-semibold">Avisos</h2>
          <button type="button" aria-label="Fechar avisos" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-cream"><IconClose className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4" aria-busy={loading}>
          <p className="mb-4 text-sm leading-relaxed text-muted">Vendas sem preço de compra informado. Complete a operação para calcular o lucro.</p>
          {loading ? <p role="status" className="py-6 text-sm text-muted">Carregando avisos…</p> : error ? <div role="alert" className="space-y-3 text-sm"><p>Não foi possível carregar os avisos.</p><button type="button" className={btn.outline} onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div> : data?.items.length === 0 ? <p role="status" className="py-6 text-sm text-muted">Nenhuma venda com essa pendência.</p> : <ul className="space-y-2">
            {data?.items.map(({ id, vehicle }) => <li key={id}><Link onClick={close} href={`/admin/veiculos/${encodeURIComponent(vehicle.id)}?view=operacao`} className="block rounded-lg border border-white/10 p-3 transition hover:border-white/25 hover:bg-white/5">
              <p className="break-words text-sm font-semibold">{vehicle.brand} {vehicle.model} · {vehicle.yearModel}</p>
              {vehicle.plate ? <p className="mt-1 text-xs text-muted">{vehicle.plate}</p> : null}
              <p className="mt-2 text-xs text-muted">Preço de compra não informado</p><span className="mt-2 block text-xs text-cream underline underline-offset-4">Completar operação</span>
            </Link></li>)}
          </ul>}
        </div>
        {!loading && !error && data && data.total > 0 ? <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-4 py-2">
          <button type="button" className={btn.ghost} disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Anterior</button>
          <span className="text-xs text-muted">{data.page}/{data.pages} · {data.total} avisos</span>
          <button type="button" className={btn.ghost} disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Próxima</button>
        </div> : null}
      </div>
    </div>, document.body) : null}
  </>;
}
