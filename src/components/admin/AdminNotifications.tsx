"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconClose } from "@/components/site/icons";
import { btn } from "@/components/admin/ui";
import { handleFocusTrap } from "@/lib/focus-trap";
import {
  NOTICE_KINDS,
  type NoticeKind,
  type NoticesResult,
} from "@/lib/admin-notifications";

export function AdminNotifications({
  count,
  onCount,
}: {
  count: number | null;
  onCount: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState<NoticeKind>("carros");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NoticesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const trigger = buttonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current
      ?.querySelector<HTMLButtonElement>("button[aria-label='Fechar avisos']")
      ?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
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
    fetch(`/api/admin/avisos?tipo=${kind}&page=${page}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("avisos");
        const result = (await response.json()) as NoticesResult;
        if (controller.signal.aborted) return;
        setData(result);
        onCount(result.counts.carros + result.counts.vendas);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, kind, page, retry, onCount]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={
          count && count > 0 ? `Avisos: ${count} pendências` : "Avisos"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setPage(1);
          setData(null);
          setOpen(true);
        }}
        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cream/80 transition hover:bg-white/5 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
          />
        </svg>
        {count && count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand"
          />
        ) : null}
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[70]">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={close}
                aria-hidden="true"
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Avisos do painel"
                className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top,0px))] flex max-h-[calc(100dvh-6rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-xl border border-white/20 bg-ink shadow-2xl sm:right-6 sm:top-6"
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-4 py-2">
                  <h2 className="font-display text-lg font-semibold">Avisos</h2>
                  <button
                    type="button"
                    aria-label="Fechar avisos"
                    onClick={close}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-cream/80 hover:bg-white/5 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <IconClose className="h-5 w-5" />
                  </button>
                </div>
                <div
                  className="min-h-0 overflow-y-auto overscroll-contain p-4"
                  aria-busy={loading}
                >
                  <div
                    className="mb-4 grid grid-cols-2 gap-2"
                    role="group"
                    aria-label="Tipo de aviso"
                  >
                    {NOTICE_KINDS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={kind === value}
                        onClick={() => {
                          setKind(value);
                          setPage(1);
                          setData(null);
                        }}
                        className={`min-h-11 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          kind === value
                            ? "bg-brand text-white"
                            : "border border-white/20 text-cream/80 hover:bg-white/5 hover:text-cream"
                        }`}
                      >
                        {label}
                        {data ? ` (${data.counts[value]})` : ""}
                      </button>
                    ))}
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-cream/80">
                    {kind === "carros"
                      ? "Carros sem foto, sem preço ou com reserva vencendo."
                      : "Vendas sem preço de compra informado para calcular o lucro."}
                  </p>
                  {loading ? (
                    <p role="status" className="py-6 text-sm text-cream/80">
                      Carregando avisos…
                    </p>
                  ) : error ? (
                    <div role="alert" className="space-y-3 text-sm">
                      <p>Não foi possível carregar os avisos.</p>
                      <button
                        type="button"
                        className={btn.outline}
                        onClick={() => setRetry((value) => value + 1)}
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : data?.items.length === 0 ? (
                    <p role="status" className="py-6 text-sm text-cream/80">
                      {kind === "carros"
                        ? "Nenhum carro pendente no estoque."
                        : "Nenhuma venda com essa pendência."}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {data?.items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg border border-white/20 p-3"
                        >
                          <Link
                            onClick={close}
                            href={item.href}
                            className="block rounded transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <p className="break-words text-sm font-semibold">
                              {item.title}
                            </p>
                            <p className="mt-2 break-words text-xs leading-relaxed text-cream/80">
                              {item.detail}
                            </p>
                            <span className="mt-2 block text-xs text-cream underline underline-offset-4">
                              {kind === "carros"
                                ? "Abrir veículo"
                                : "Completar operação"}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {!loading && !error && data && data.total > 0 ? (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/15 px-4 py-2">
                    <button
                      type="button"
                      className={btn.ghost}
                      disabled={data.page <= 1}
                      onClick={() => setPage(data.page - 1)}
                    >
                      Anterior
                    </button>
                    <span className="text-xs text-cream/80">
                      {data.page}/{data.pages} · {data.total} avisos
                    </span>
                    <button
                      type="button"
                      className={btn.ghost}
                      disabled={data.page >= data.pages}
                      onClick={() => setPage(data.page + 1)}
                    >
                      Próxima
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
