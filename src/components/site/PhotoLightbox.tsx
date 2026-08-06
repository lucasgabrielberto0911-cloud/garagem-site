"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { IconClose } from "@/components/site/icons";

const MAX_SCALE = 4;
const ZOOM_STEP = 2.4;
const SWIPE_THRESHOLD = 55;

type Photo = { id: string; url: string };

export function PhotoLightbox({
  photos,
  alt,
  index,
  onIndexChange,
  onClose,
}: {
  photos: Photo[];
  alt: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const total = photos.length;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hint, setHint] = useState(true);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const offsetStart = useRef({ x: 0, y: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const dragged = useRef(false);
  const lastTapAt = useRef(0);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (direction: 1 | -1) => {
      if (total < 2) return;
      reset();
      onIndexChange((index + direction + total) % total);
    },
    [index, total, onIndexChange, reset],
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "0") reset();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, reset]);

  function toggleZoom() {
    if (scale > 1) {
      reset();
    } else {
      setScale(ZOOM_STEP);
    }
  }

  function clampOffset(next: { x: number; y: number }, currentScale: number) {
    const limit = 240 * (currentScale - 1);
    return {
      x: Math.max(-limit, Math.min(limit, next.x)),
      y: Math.max(-limit, Math.min(limit, next.y)),
    };
  }

  function onTouchStart(event: React.TouchEvent) {
    dragged.current = false;
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];
      pinchStart.current = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale,
      };
      pointerStart.current = null;
      return;
    }
    pinchStart.current = null;
    pointerStart.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
    offsetStart.current = offset;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (event.touches.length === 2 && pinchStart.current) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = Math.max(
        1,
        Math.min(MAX_SCALE, (distance / pinchStart.current.distance) * pinchStart.current.scale),
      );
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
      dragged.current = true;
      return;
    }

    if (!pointerStart.current) return;
    const dx = event.touches[0].clientX - pointerStart.current.x;
    const dy = event.touches[0].clientY - pointerStart.current.y;

    if (scale > 1) {
      dragged.current = true;
      setOffset(
        clampOffset(
          { x: offsetStart.current.x + dx, y: offsetStart.current.y + dy },
          scale,
        ),
      );
    } else if (Math.abs(dx) > 8) {
      dragged.current = true;
    }
  }

  function onTouchEnd(event: React.TouchEvent) {
    const touch = event.changedTouches[0];

    if (pointerStart.current && touch) {
      const dx = touch.clientX - pointerStart.current.x;
      const dy = touch.clientY - pointerStart.current.y;

      if (Math.hypot(dx, dy) < 12) {
        // Toque parado: pode ser o segundo toque de um duplo toque. O evento
        // dblclick nativo não é confiável em todos os navegadores móveis.
        const now = Date.now();
        if (now - lastTapAt.current < 320) {
          lastTapAt.current = 0;
          toggleZoom();
        } else {
          lastTapAt.current = now;
        }
      } else if (
        scale === 1 &&
        Math.abs(dx) > SWIPE_THRESHOLD &&
        Math.abs(dx) > Math.abs(dy)
      ) {
        go(dx < 0 ? 1 : -1);
      }
    }

    pointerStart.current = null;
    pinchStart.current = null;
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "touch") return;
    dragged.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    offsetStart.current = offset;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (event.pointerType === "touch" || !pointerStart.current) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (scale > 1) {
      dragged.current = true;
      setOffset(
        clampOffset(
          { x: offsetStart.current.x + dx, y: offsetStart.current.y + dy },
          scale,
        ),
      );
    } else if (Math.abs(dx) > 8) {
      dragged.current = true;
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    if (event.pointerType === "touch" || !pointerStart.current) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (Math.hypot(dx, dy) < 12) {
      // handled by double-click
    } else if (
      scale === 1 &&
      Math.abs(dx) > SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      go(dx < 0 ? 1 : -1);
    }
    pointerStart.current = null;
  }

  const photo = photos[index];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/96 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos do ${alt}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-safe">
        <span className="py-4 text-xs font-medium text-cream/80">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleZoom}
            aria-label={scale > 1 ? "Reduzir zoom" : "Ampliar foto"}
            className="flex h-11 w-11 items-center justify-center border border-white/20 text-cream transition hover:border-brand touch-manipulation"
          >
            <ZoomIcon zoomed={scale > 1} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar galeria"
            className="flex h-11 w-11 items-center justify-center border border-white/20 text-cream transition hover:border-brand touch-manipulation"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 select-none overflow-hidden touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={toggleZoom}
      >
        <div
          className="absolute inset-0 transition-transform duration-200 ease-out"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: scale > 1 ? "grab" : "zoom-in",
          }}
        >
          <VehicleImage
            src={photo?.url}
            alt={`${alt} — foto ${index + 1} de ${total}`}
            fill
            sizes="100vw"
            quality={82}
            priority
            className="object-contain"
          />
        </div>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/40 text-cream backdrop-blur transition hover:border-brand sm:flex"
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/40 text-cream backdrop-blur transition hover:border-brand sm:flex"
            >
              <Chevron direction="right" />
            </button>
          </>
        ) : null}

        {hint ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] uppercase tracking-wider text-cream/60">
            Toque duas vezes para ampliar · deslize para trocar
          </p>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="overflow-x-auto px-4 py-3 scrollbar-hide pb-safe">
          <div className="mx-auto flex w-max gap-2">
            {photos.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  reset();
                  onIndexChange(itemIndex);
                }}
                aria-label={`Ver foto ${itemIndex + 1}`}
                aria-current={itemIndex === index}
                className={`relative h-14 w-20 shrink-0 overflow-hidden border transition ${
                  itemIndex === index
                    ? "border-brand"
                    : "border-white/15 opacity-60 hover:opacity-100"
                }`}
              >
                <VehicleImage
                  src={item.url}
                  alt=""
                  fill
                  sizes="80px"
                  quality={45}
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ZoomIcon({ zoomed }: { zoomed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
      <path d={zoomed ? "M8 11h6" : "M8 11h6M11 8v6"} />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
