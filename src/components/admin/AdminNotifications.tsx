"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconClose } from "@/components/site/icons";
import { btn } from "@/components/admin/ui";
import { handleFocusTrap } from "@/lib/focus-trap";
import { NOTICE_KINDS, type NoticeKind, type NoticesResult } from "@/lib/admin-notifications";

export function AdminNotifications({ count, onCount }: { count: number | null; onCount: (count: number) => void }) {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState<NoticeKind>("hoje");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NoticesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState("");
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
    fetch(`/api/admin/avisos?tipo=${kind}&page=${page}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("avisos");
        const result = await response.json() as NoticesResult;
        if (controller.signal.aborted) return;
        setData(result);
        onCount(result.counts.hoje + result.counts.atrasados + result.counts.vendas + result.counts.pedidos);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, kind, page, retry, onCount]);

  async function dismiss(item: NoticesResult["items"][number]) {
    if (dismissing) return;
    setDismissing(item.id);
    setDismissError("");
    try {
      const response = await fetch("/api/admin/pedidos/compatibilidade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: item.leadId, vehicleId: item.vehicleId }),
      });
      if (!response.ok) throw new Error("dispensar");
      setRetry(value => value + 1);
    } catch { setDismissError("Não foi possível dispensar. Tente novamente."); }
    finally { setDismissing(null); }
  }

  return <>
    <button ref={buttonRef} type="button" aria-label={count && count > 0 ? `Avisos: ${count} pendências` : "Avisos"}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { setPage(1); setData(null); setDismissError(""); setOpen(true); }}
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
          <div className="mb-4 grid grid-cols-2 gap-1 sm:grid-cols-4" role="group" aria-label="Tipo de aviso">
            {NOTICE_KINDS.map(({ value, label }) => <button key={value} type="button" aria-pressed={kind === value}
              onClick={() => { setKind(value); setPage(1); setData(null); setDismissError(""); }}
              className={`min-h-11 rounded-lg px-1 text-xs font-semibold transition ${kind === value ? "bg-brand text-cream" : "border border-white/10 text-muted hover:bg-white/5"}`}>
              {label}{data ? ` (${data.counts[value]})` : ""}
            </button>)}
          </div>
          <p className="mb-3 text-sm leading-relaxed text-muted">{kind === "pedidos" ? "Sugestões para os pedidos recebidos. Confira os detalhes e chame o cliente quando fizer sentido." : kind === "vendas" ? "Complete o preço de compra para calcular o lucro." : kind === "atrasados" ? "Retornos de dias anteriores que ainda estão em aberto." : "Seus retornos programados para hoje."}</p>
          {kind === "hoje" || kind === "atrasados" ? <Link onClick={close} href={`/admin/agenda?periodo=${kind}`} className="mb-4 inline-flex min-h-11 items-center text-sm text-cream underline underline-offset-4">Abrir agenda</Link> : null}
          {loading ? <p role="status" className="py-6 text-sm text-muted">Carregando avisos…</p> : error ? <div role="alert" className="space-y-3 text-sm"><p>Não foi possível carregar os avisos.</p><button type="button" className={btn.outline} onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div> : data?.items.length === 0 ? <p role="status" className="py-6 text-sm text-muted">{kind === "pedidos" ? "Nenhuma opção compatível com os pedidos em aberto." : kind === "vendas" ? "Nenhuma venda com essa pendência." : "Nenhum retorno neste período."}</p> : <ul className="space-y-2">
            {data?.items.map((item) => <li key={item.id} className="rounded-lg border border-white/10 p-3">
              <Link onClick={close} href={item.href} className="block rounded transition hover:text-brand">
                <p className="break-words text-sm font-semibold">{item.title}</p>
                {item.at ? <p className="mt-1 text-xs text-muted">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(item.at))}</p> : null}
                <p className="mt-2 break-words text-xs leading-relaxed text-muted">{item.detail}</p>
                <span className="mt-2 block text-xs text-cream underline underline-offset-4">{kind === "vendas" ? "Completar operação" : "Abrir atendimento"}</span>
              </Link>
              {kind === "pedidos" ? <>
                <p className="mt-3 text-xs leading-relaxed text-muted">Critérios informados: {item.criteria}. Confira os demais detalhes com o cliente.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {item.vehicleHref ? <Link href={item.vehicleHref} target="_blank" rel="noopener noreferrer" className={btn.outline}>Ver veículo</Link> : null}
                  {item.whatsappHref ? <a href={item.whatsappHref} target="_blank" rel="noopener noreferrer" className={btn.primary}>Chamar cliente</a> : null}
                </div>
                <button type="button" disabled={dismissing !== null} onClick={() => void dismiss(item)} className="mt-2 min-h-11 text-xs text-muted underline underline-offset-4 disabled:opacity-50">
                  {dismissing === item.id ? "Dispensando…" : "Dispensar esta sugestão"}
                </button>
              </> : null}
            </li>)}
          </ul>}
          {dismissError ? <p role="alert" className="mt-3 text-sm text-brand-orange">{dismissError}</p> : null}
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
