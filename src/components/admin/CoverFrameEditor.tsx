"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { IconClose } from "@/components/site/icons";
import { btn } from "@/components/admin/ui";
import {
  COVER_ZOOM_MAX,
  COVER_ZOOM_MIN,
  DEFAULT_COVER_FRAME,
  coverCropRect,
  coverFrameFromCardUrl,
  cropToCss,
  cropToFractions,
  panCoverFrame,
  zoomCoverFrame,
  type CoverFrame,
} from "@/lib/cover-frame";
import { handleFocusTrap } from "@/lib/focus-trap";
import { galleryPreviewSrc } from "@/lib/stock-query";

type Props = {
  url: string;
  thumbnailUrl?: string | null;
  applying: boolean;
  onClose: () => void;
  onApply: (frame: CoverFrame) => void;
};

type Gesture =
  | { kind: "pan"; x: number; y: number; frame: CoverFrame }
  | { kind: "pinch"; distance: number; frame: CoverFrame };

const ZOOM_STEP = 10;
/** Altura máxima da foto no celular, para a prévia e os botões caberem na mesma tela. */
const STAGE_MAX_HEIGHT = "40dvh";

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
}

/**
 * Escolhe a área da capa que vira a miniatura 4:3 do card. A foto aparece
 * inteira; o quadro claro é o que o card mostra. Arrastar move o quadro,
 * pinça ou o controle de zoom aproxima. A prévia abaixo usa a mesma conta
 * do servidor (`coverCropRect`).
 */
export default function CoverFrameEditor({ url, thumbnailUrl, applying, onClose, onApply }: Props) {
  const initial = coverFrameFromCardUrl(thumbnailUrl);
  const [frame, setFrame] = useState<CoverFrame>(initial ?? DEFAULT_COVER_FRAME);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const live = useRef({ applying, onClose });
  live.current = { applying, onClose };
  const src = galleryPreviewSrc({ id: "", url });

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

  const ready = Boolean(size) && !imageError;
  const rect = size ? coverCropRect(size.w, size.h, frame) : null;
  const unchanged = Boolean(initial) && initial!.x === frame.x && initial!.y === frame.y && initial!.zoom === frame.zoom;

  function startGesture() {
    const points = [...pointers.current.values()];
    if (points.length === 1) gesture.current = { kind: "pan", x: points[0].x, y: points[0].y, frame };
    else if (points.length >= 2) gesture.current = { kind: "pinch", distance: distance(points[0], points[1]), frame };
    else gesture.current = null;
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!ready || applying || (event.pointerType === "mouse" && event.button !== 0)) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* o gesto segue sem captura */ }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!size || !current || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (current.kind === "pan" && points.length === 1) {
      const width = stage.current?.getBoundingClientRect().width || size.w;
      const scale = size.w / width;
      setFrame(panCoverFrame(size.w, size.h, current.frame, (event.clientX - current.x) * scale, (event.clientY - current.y) * scale));
    } else if (current.kind === "pinch" && points.length >= 2) {
      setFrame(zoomCoverFrame(size.w, size.h, current.frame, (current.frame.zoom * distance(points[0], points[1])) / current.distance));
    }
  }
  function pointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    startGesture();
  }
  function changeZoom(zoom: number) {
    if (size) setFrame(current => zoomCoverFrame(size.w, size.h, current, zoom));
  }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!size || applying) return;
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (step) {
      event.preventDefault();
      setFrame(current => panCoverFrame(size.w, size.h, current, step[0] * size.w * 0.02, step[1] * size.h * 0.02));
    } else if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(frame.zoom + ZOOM_STEP); }
    else if (event.key === "-") { event.preventDefault(); changeZoom(frame.zoom - ZOOM_STEP); }
  }

  const box = size && rect ? cropToFractions(size.w, size.h, rect) : null;
  return createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
    <div className="absolute inset-0 bg-black/70" aria-hidden="true" onClick={() => { if (!applying) onClose(); }} />
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Enquadrar capa" className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/15 bg-ink shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
        <h2 className="font-display text-lg font-semibold">Enquadrar capa</h2>
        <button type="button" aria-label="Fechar enquadramento" disabled={applying} onClick={onClose} className="flex h-11 w-11 items-center justify-center text-muted disabled:opacity-50"><IconClose className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
        <p className="mb-3 text-sm leading-relaxed text-muted">Arraste o quadro claro para escolher a parte da foto que aparece no card. Use o zoom para aproximar. O que fica escuro não aparece na capa.</p>
        <div
          ref={stage}
          role="group"
          tabIndex={0}
          aria-label="Foto com o quadro da capa. Setas movem o quadro; mais e menos mudam o zoom."
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
          onKeyDown={keyDown}
          className="relative mx-auto touch-none select-none overflow-hidden rounded-lg bg-asphalt outline-none focus-visible:ring-2 focus-visible:ring-cream/60"
          style={{ aspectRatio: size ? size.w / size.h : 4 / 3, width: size ? `min(100%, calc(${STAGE_MAX_HEIGHT} * ${size.w / size.h}))` : "100%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia do admin; precisa das medidas reais da foto */}
          <img
            src={src}
            alt="Foto da capa inteira"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            onLoad={event => { const image = event.currentTarget; setSize({ w: image.naturalWidth, h: image.naturalHeight }); setImageError(false); }}
            onError={() => { setImageError(true); setSize(null); }}
          />
          {box ? <div aria-hidden="true" className="pointer-events-none absolute border-2 border-cream shadow-[0_0_0_9999px_rgba(13,13,15,0.68)]" style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} /> : null}
        </div>
        {imageError ? <p role="alert" className="mt-3 text-sm text-brand">Não foi possível carregar a foto. Feche e tente novamente.</p> : !size ? <p role="status" className="mt-2 text-xs text-muted">Carregando foto…</p> : null}

        <div className="mt-3 flex items-center gap-2">
          <button type="button" aria-label="Diminuir zoom" disabled={!ready || applying || frame.zoom <= COVER_ZOOM_MIN} onClick={() => changeZoom(frame.zoom - ZOOM_STEP)} className={`${btn.outline} !px-0 w-11 shrink-0 text-lg`}>−</button>
          <input type="range" aria-label="Zoom da capa" min={COVER_ZOOM_MIN} max={COVER_ZOOM_MAX} step={5} value={frame.zoom} disabled={!ready || applying} onChange={event => changeZoom(Number(event.target.value))} className="h-11 min-w-0 flex-1 accent-brand touch-manipulation" />
          <button type="button" aria-label="Aumentar zoom" disabled={!ready || applying || frame.zoom >= COVER_ZOOM_MAX} onClick={() => changeZoom(frame.zoom + ZOOM_STEP)} className={`${btn.outline} !px-0 w-11 shrink-0 text-lg`}>+</button>
        </div>
        <p className="text-center text-xs text-muted" role="status">Zoom {frame.zoom}%</p>

        <div className="mt-3 flex items-end gap-3">
          <div className="w-[173px] shrink-0">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-asphalt" aria-label="Prévia da capa no card">
              {size && rect ? (
                // eslint-disable-next-line @next/next/no-img-element -- mesma foto do quadro, posicionada pela conta do servidor
                <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={cropToCss(size.w, size.h, rect)} />
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted">Como fica no card (tamanho do celular)</p>
          </div>
          <button type="button" className={`${btn.ghost} ml-auto`} disabled={!ready || applying} onClick={() => setFrame(DEFAULT_COVER_FRAME)}>Centralizar</button>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 p-3">
        <button type="button" className={btn.outline} disabled={applying} onClick={onClose}>Cancelar</button>
        <button type="button" className={btn.primary} disabled={applying || !ready || unchanged} onClick={() => onApply(frame)}>{applying ? "Aplicando…" : "Aplicar"}</button>
      </div>
    </div>
  </div>, document.body);
}
