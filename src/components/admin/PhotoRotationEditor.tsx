"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconClose } from "@/components/site/icons";
import { btn } from "@/components/admin/ui";
import { handleFocusTrap } from "@/lib/focus-trap";

type Props = { url: string; applying: boolean; onClose: () => void; onApply: (operation: { degrees: number } | { restore: true }) => void };
export default function PhotoRotationEditor({ url, applying, onClose, onApply }: Props) {
  const [degrees, setDegrees] = useState(0);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const live = useRef({ applying, onClose }); live.current = { applying, onClose };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const focus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !live.current.applying) { event.preventDefault(); live.current.onClose(); }
      if (dialog.current) handleFocusTrap(event, dialog.current);
    }
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", key); focus?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setChecking(true); setCheckError(false);
    fetch(`/api/upload/rotate?url=${encodeURIComponent(url)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("previous"); return response.json(); })
      .then(result => { if (!controller.signal.aborted) setHasPrevious(result.hasPrevious === true); })
      .catch(() => { if (!controller.signal.aborted) setCheckError(true); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [url, retry]);
  function showPrevious() { setRestoring(value => !value); setImageReady(false); setImageError(false); }
  return createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
    <div className="absolute inset-0 bg-black/70" aria-hidden="true" onClick={() => { if (!applying) onClose(); }} />
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Girar foto" className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/15 bg-ink shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2"><h2 className="font-display text-lg font-semibold">Girar foto</h2><button type="button" aria-label="Fechar rotação" disabled={applying} onClick={onClose} className="flex h-11 w-11 items-center justify-center text-muted disabled:opacity-50"><IconClose className="h-5 w-5" /></button></div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
        <p className="mb-3 text-sm leading-relaxed text-muted">Confira a posição antes de aplicar. A versão anterior fica guardada. Salve o anúncio para publicar.</p>
        <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-lg bg-asphalt" aria-label="Prévia da foto">
          <Image unoptimized key={restoring ? "previous" : "current"} src={restoring ? `/api/upload/rotate?url=${encodeURIComponent(url)}&preview=1` : url} alt={restoring ? "Versão anterior da foto" : "Prévia da rotação"} fill sizes="320px" priority className="object-contain" style={{ transform: `rotate(${restoring ? 0 : degrees}deg)` }} onLoad={() => setImageReady(true)} onError={() => { setImageError(true); setImageReady(false); }} />
        </div>
        {imageError ? <p role="alert" className="mt-3 text-sm text-brand">Não foi possível carregar a prévia. Feche e tente novamente.</p> : !imageReady ? <p role="status" className="mt-2 text-xs text-muted">Carregando prévia…</p> : null}
        <p className="mt-2 text-center text-xs text-muted" role="status">{restoring ? "Versão anterior" : degrees === 0 ? "Posição atual" : `${degrees}° para a direita`}</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className={btn.outline} disabled={applying || restoring} onClick={() => setDegrees(value => (value + 270) % 360)}>↶ Esquerda</button><button type="button" className={btn.outline} disabled={applying || restoring} onClick={() => setDegrees(value => (value + 90) % 360)}>Direita ↷</button></div>
        {checking ? <p className="mt-3 text-xs text-muted">Conferindo versão anterior…</p> : checkError ? <button type="button" disabled={applying} className={`${btn.ghost} mt-2 w-full`} onClick={() => setRetry(value => value + 1)}>Conferir versão anterior novamente</button> : hasPrevious ? <button type="button" disabled={applying} className={`${btn.ghost} mt-2 w-full`} onClick={showPrevious}>{restoring ? "Voltar à foto atual" : "Ver versão anterior"}</button> : null}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 p-3"><button type="button" className={btn.outline} disabled={applying} onClick={onClose}>Cancelar</button><button type="button" className={btn.primary} disabled={applying || !imageReady || imageError || (!restoring && degrees === 0)} onClick={() => onApply(restoring ? { restore: true } : { degrees })}>{applying ? "Aplicando…" : restoring ? "Restaurar foto" : "Aplicar giro"}</button></div>
    </div>
  </div>, document.body);
}
