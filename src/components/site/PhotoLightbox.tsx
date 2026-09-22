"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { VehicleImage } from "@/components/VehicleImage";
import { IconClose } from "@/components/site/icons";
import { downloadAttachment } from "@/lib/download-attachment";
import { vehiclePhotoAlt } from "@/lib/format";
import { publicPhotoJpgPath } from "@/lib/photo-archive";
import { handleFocusTrap } from "@/lib/focus-trap";
import { galleryThumbSrc, type GalleryPhoto } from "@/lib/stock-query";

const MAX_SCALE = 4;
const ZOOM_STEP = 2.4;
const SWIPE_THRESHOLD = 55;

type Photo = GalleryPhoto;

/**
 * Galeria em quase tela cheia. Renderiza via portal no `document.body`
 * para não ficar preso em sticky/overflow da página do anúncio.
 */
export function PhotoLightbox({
  photos,
  alt,
  vehicleId,
  index,
  onIndexChange,
  onClose,
}: {
  photos: Photo[];
  alt: string;
  vehicleId: string;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const total = photos.length;
  const safeIndex = ((index % total) + total) % total;
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hint, setHint] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const offsetStart = useRef({ x: 0, y: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const lastTapAt = useRef(0);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (direction: 1 | -1) => {
      if (total < 2) return;
      resetZoom();
      const next = (safeIndex + direction + total) % total;
      onIndexChange(next);
    },
    [safeIndex, total, onIndexChange, resetZoom],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    resetZoom();
  }, [safeIndex, resetZoom]);

  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!strip) return;
    const activeBtn = strip.children[safeIndex] as HTMLElement | undefined;
    if (!activeBtn) return;
    // scrollIntoView no iOS empurra a página/lightbox; rolamos só a faixa.
    const left =
      activeBtn.offsetLeft - (strip.clientWidth - activeBtn.clientWidth) / 2;
    strip.scrollTo({
      left: Math.max(0, left),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [safeIndex]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) {
      document.body.style.paddingRight = `${scrollbar}px`;
    }
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 2800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
      if (event.key === "0") resetZoom();
      if (dialogRef.current) handleFocusTrap(event, dialogRef.current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, resetZoom]);

  const downloadJpg = useCallback(async () => {
    const current = photos[safeIndex];
    if (!current || downloading) return;
    setDownloading(true);
    try {
      await downloadAttachment(
        publicPhotoJpgPath(vehicleId, current.id),
        "foto.jpg",
      );
      toast.success("JPG baixado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível baixar o JPG.",
      );
    } finally {
      setDownloading(false);
    }
  }, [downloading, photos, safeIndex, vehicleId]);

  function toggleZoom() {
    if (scale > 1) resetZoom();
    else setScale(ZOOM_STEP);
  }

  function clampOffset(next: { x: number; y: number }, currentScale: number) {
    const limit = 280 * (currentScale - 1);
    return {
      x: Math.max(-limit, Math.min(limit, next.x)),
      y: Math.max(-limit, Math.min(limit, next.y)),
    };
  }

  function onTouchStart(event: React.TouchEvent) {
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
        Math.min(
          MAX_SCALE,
          (distance / pinchStart.current.distance) * pinchStart.current.scale,
        ),
      );
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return;
    }

    if (!pointerStart.current) return;
    const dx = event.touches[0].clientX - pointerStart.current.x;
    const dy = event.touches[0].clientY - pointerStart.current.y;

    if (scale > 1) {
      setOffset(
        clampOffset(
          { x: offsetStart.current.x + dx, y: offsetStart.current.y + dy },
          scale,
        ),
      );
    }
  }

  function onTouchEnd(event: React.TouchEvent) {
    const touch = event.changedTouches[0];
    if (pointerStart.current && touch) {
      const dx = touch.clientX - pointerStart.current.x;
      const dy = touch.clientY - pointerStart.current.y;

      if (Math.hypot(dx, dy) < 12) {
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
    pointerStart.current = { x: event.clientX, y: event.clientY };
    offsetStart.current = offset;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (event.pointerType === "touch" || !pointerStart.current) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (scale > 1) {
      setOffset(
        clampOffset(
          { x: offsetStart.current.x + dx, y: offsetStart.current.y + dy },
          scale,
        ),
      );
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    if (event.pointerType === "touch" || !pointerStart.current) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (
      scale === 1 &&
      Math.abs(dx) > SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      go(dx < 0 ? 1 : -1);
    }
    pointerStart.current = null;
  }

  const photo = photos[safeIndex];

  const content = (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[200] flex items-center justify-center overscroll-contain p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Fundo borrado + escurecido — cobre a página inteira */}
      <button
        type="button"
        aria-label="Fechar galeria"
        className="absolute inset-0 bg-asphalt/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      <div className="relative z-[1] flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden bg-black pt-safe shadow-2xl animate-fade-in-scale sm:h-[min(92dvh,920px)] sm:border sm:border-white/10 sm:pt-0">
        <header className="relative z-[2] flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-3 py-2.5 backdrop-blur sm:px-4">
          <div className="min-w-0">
            <p id={titleId} className="truncate text-sm font-medium text-cream">
              {alt}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-cream/60">
              {safeIndex + 1} / {total}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void downloadJpg();
              }}
              disabled={downloading}
              aria-label="Baixar esta foto em JPG"
              className="inline-flex h-11 items-center gap-1.5 border border-white/20 px-2.5 font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition hover:border-brand touch-manipulation disabled:opacity-60 sm:px-3"
            >
              <DownloadIcon />
              <span className="sm:hidden">{downloading ? "…" : "JPG"}</span>
              <span className="hidden sm:inline">
                {downloading ? "Preparando…" : "Baixar JPG"}
              </span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleZoom();
              }}
              aria-label={scale > 1 ? "Reduzir zoom" : "Ampliar foto"}
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-cream transition hover:border-brand touch-manipulation"
            >
              <ZoomIcon zoomed={scale > 1} />
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              aria-label="Fechar galeria"
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-cream transition hover:border-brand touch-manipulation"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 bg-black">
          <div
            className="absolute inset-0 touch-none select-none [-webkit-touch-callout:none]"
            onContextMenu={(event) => {
              event.preventDefault();
              void downloadJpg();
            }}
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
                alt={vehiclePhotoAlt(alt, safeIndex, total)}
                fill
                sizes="100vw"
                quality={85}
                priority
                className="pointer-events-none object-contain [-webkit-touch-callout:none]"
              />
            </div>
          </div>

          {total > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(-1);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Foto anterior"
                className="absolute left-[max(0.5rem,env(safe-area-inset-left,0px))] top-1/2 z-[3] flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/25 bg-black/55 text-cream backdrop-blur transition hover:border-brand active:border-brand touch-manipulation sm:left-[max(1rem,env(safe-area-inset-left,0px))] sm:h-14 sm:w-14"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(1);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Próxima foto"
                className="absolute right-[max(0.5rem,env(safe-area-inset-right,0px))] top-1/2 z-[3] flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/25 bg-black/55 text-cream backdrop-blur transition hover:border-brand active:border-brand touch-manipulation sm:right-[max(1rem,env(safe-area-inset-right,0px))] sm:h-14 sm:w-14"
              >
                <Chevron direction="right" />
              </button>
            </>
          ) : null}

          {hint ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[3] text-center text-[11px] uppercase tracking-wider text-cream/55">
              Deslize ou use as setas · toque duas vezes para ampliar
            </p>
          ) : null}
        </div>

        {total > 1 ? (
          <div className="relative z-[2] shrink-0 border-t border-white/10 bg-black/80 px-3 py-3 backdrop-blur sm:px-4 pb-safe">
            <div
              ref={thumbStripRef}
              className="flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide [-webkit-overflow-scrolling:touch]"
            >
              {photos.map((item, itemIndex) => {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      resetZoom();
                      onIndexChange(itemIndex);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label={`Ver foto ${itemIndex + 1}`}
                    aria-current={itemIndex === safeIndex}
                    className={`relative h-14 w-[4.5rem] shrink-0 overflow-hidden border bg-asphalt transition sm:h-16 sm:w-24 ${
                      itemIndex === safeIndex
                        ? "border-brand opacity-100"
                        : "border-white/15 opacity-55 hover:opacity-100 active:opacity-100"
                    }`}
                  >
                    <VehicleImage
                      src={galleryThumbSrc(item)}
                      alt={vehiclePhotoAlt(alt, itemIndex, total)}
                      fill
                      sizes="96px"
                      quality={45}
                      className="object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 4v10M8 11l4 4 4-4" />
      <path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />
    </svg>
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
