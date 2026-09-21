"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { btn } from "@/components/admin/ui";
import { handleFocusTrap } from "@/lib/focus-trap";
import {
  MAX_MANUAL_BLUR_RECTS,
  isDrawableRect,
  rectFromPoints,
  type NormalizedRect,
} from "@/lib/blur-rects";

type Frame = { left: number; top: number; width: number; height: number };

/**
 * O admin arrasta retângulos sobre a foto (placa, placa da loja).
 * O borrão em si roda no servidor — aqui só marca a área.
 */
export function PlateBlurEditor({
  open,
  imageUrl,
  applying,
  blurred,
  onClose,
  onApply,
}: {
  open: boolean;
  imageUrl: string;
  applying: boolean;
  blurred: boolean;
  onClose: () => void;
  onApply: (rects: NormalizedRect[]) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const onCloseRef = useRef(onClose);
  const applyingRef = useRef(applying);
  onCloseRef.current = onClose;
  applyingRef.current = applying;
  const [mounted, setMounted] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [rects, setRects] = useState<NormalizedRect[]>([]);
  const [draft, setDraft] = useState<NormalizedRect | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setRects([]);
    setDraft(null);
    setFailed(false);
    dragRef.current = null;
  }, [imageUrl]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!applyingRef.current) onCloseRef.current();
        return;
      }
      if (panel) handleFocusTrap(event, panel);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(stage);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, imageUrl]);

  function measure() {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return;
    const stageBox = stage.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (
      !naturalWidth ||
      !naturalHeight ||
      imageBox.width < 2 ||
      imageBox.height < 2
    ) {
      setFrame(null);
      return;
    }
    const scale = Math.min(
      imageBox.width / naturalWidth,
      imageBox.height / naturalHeight,
    );
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    setFrame({
      left: imageBox.left - stageBox.left + (imageBox.width - width) / 2,
      top: imageBox.top - stageBox.top + (imageBox.height - height) / 2,
      width,
      height,
    });
  }

  function pointFromEvent(event: React.PointerEvent) {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const bounds = overlay.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return null;
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (applying) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const start = pointFromEvent(event);
    if (!start) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = start;
    setDraft(rectFromPoints(start, start));
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start) return;
    const current = pointFromEvent(event);
    if (!current) return;
    setDraft(rectFromPoints(start, current));
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    dragRef.current = null;
    setDraft(null);
    if (!start || applying) return;
    const current = pointFromEvent(event);
    if (!current || !frame) return;
    const rect = rectFromPoints(start, current);
    if (!isDrawableRect(rect, frame.width, frame.height)) return;
    setRects((currentRects) => {
      if (currentRects.length >= MAX_MANUAL_BLUR_RECTS) return currentRects;
      return [...currentRects, rect];
    });
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-asphalt/80 p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plate-blur-title"
        className="flex h-[100dvh] w-full max-w-4xl flex-col border border-white/10 bg-ink shadow-2xl sm:h-[min(920px,100dvh)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2
              id="plate-blur-title"
              className="font-display text-sm font-semibold uppercase tracking-wide text-cream"
            >
              Borrar placa
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Arraste um retângulo em volta da placa. Se a placa da loja também
              aparecer, marque outro. O borrão cobre só essa área.
            </p>
          </div>
          <button
            type="button"
            className={btn.ghost}
            onClick={onClose}
            disabled={applying}
            aria-label="Fechar"
          >
            Fechar
          </button>
        </header>

        <div ref={stageRef} className="relative min-h-0 flex-1 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- a caixa do retângulo precisa do tamanho real da foto */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Foto para marcar a placa"
            draggable={false}
            onLoad={() => {
              setFailed(false);
              measure();
            }}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-contain select-none"
          />
          {frame ? (
            <div
              ref={overlayRef}
              className="absolute touch-none"
              style={{
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              <span className="sr-only">
                Arraste para marcar a região da placa
              </span>
              {rects.map((rect, index) => (
                <div
                  key={`${rect.x}-${rect.y}-${rect.width}-${rect.height}-${index}`}
                  className="absolute border-2 border-brand bg-brand/35"
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.width * 100}%`,
                    height: `${rect.height * 100}%`,
                  }}
                >
                  <span className="absolute left-0 top-0 bg-brand px-1 font-display text-[10px] font-semibold text-cream">
                    {index + 1}
                  </span>
                </div>
              ))}
              {draft && draft.width > 0 && draft.height > 0 ? (
                <div
                  className="absolute border-2 border-dashed border-cream bg-white/20"
                  style={{
                    left: `${draft.x * 100}%`,
                    top: `${draft.y * 100}%`,
                    width: `${draft.width * 100}%`,
                    height: `${draft.height * 100}%`,
                  }}
                />
              ) : null}
            </div>
          ) : null}
          {failed ? (
            <p className="absolute inset-x-0 bottom-3 px-4 text-center text-sm text-cream">
              Não foi possível abrir esta foto.
            </p>
          ) : null}
        </div>

        <footer className="space-y-3 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {blurred ? (
            <p className="border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-sm text-cream">
              Região borracha. Marque outra se precisar, feche e{" "}
              <strong>salve o anúncio</strong> para publicar no site.
            </p>
          ) : (
            <p className="text-xs text-muted">
              {rects.length === 0
                ? "Nenhum retângulo ainda. Arraste com o mouse ou o dedo sobre a placa."
                : `${rects.length} retângulo(s). Aplicar borra só essas áreas.`}
            </p>
          )}
          {rects.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {rects.map((rect, index) => (
                <li key={`${rect.x}-${rect.y}-${index}`}>
                  <button
                    type="button"
                    className={btn.outline}
                    disabled={applying}
                    onClick={() =>
                      setRects((current) =>
                        current.filter((_, item) => item !== index),
                      )
                    }
                  >
                    Remover {index + 1}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {rects.length >= MAX_MANUAL_BLUR_RECTS ? (
            <p className="text-xs text-muted">
              Máximo de {MAX_MANUAL_BLUR_RECTS} retângulos nesta foto.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${btn.primary} min-w-[44px] flex-1 sm:flex-none`}
              disabled={applying || rects.length === 0 || failed}
              onClick={() => onApply(rects)}
            >
              {applying ? "Borrando…" : "Aplicar borrão"}
            </button>
            <button
              type="button"
              className={btn.outline}
              disabled={applying || rects.length === 0}
              onClick={() => setRects([])}
            >
              Limpar
            </button>
            <button
              type="button"
              className={btn.ghost}
              disabled={applying}
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
