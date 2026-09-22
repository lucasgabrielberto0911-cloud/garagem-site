"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { VehicleImage } from "@/components/VehicleImage";
import { downloadAttachment } from "@/lib/download-attachment";
import { vehiclePhotoAlt } from "@/lib/format";
import { publicPhotoJpgPath } from "@/lib/photo-archive";
import {
  galleryPreviewSrc,
  galleryPreviewSrcSet,
  galleryThumbSrc,
  shouldLoadGallerySlide,
  type GalleryPhoto,
} from "@/lib/stock-query";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const PhotoLightbox = dynamic(
  () =>
    import("@/components/site/PhotoLightbox").then((mod) => mod.PhotoLightbox),
  { ssr: false },
);

/**
 * Galeria em faixa horizontal (snap). Miniaturas no mobile e no desktop.
 * A proporção 16/10 fica reservada para não pular o layout.
 */
export function VehicleGallery({
  photos,
  alt,
  vehicleId,
}: {
  photos: GalleryPhoto[];
  alt: string;
  vehicleId: string;
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const total = photos.length;

  const downloadJpg = useCallback(
    async (photoId: string) => {
      if (downloadId) return;
      setDownloadId(photoId);
      try {
        await downloadAttachment(
          publicPhotoJpgPath(vehicleId, photoId),
          "foto.jpg",
        );
        toast.success("JPG baixado.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível baixar o JPG.",
        );
      } finally {
        setDownloadId(null);
      }
    },
    [downloadId, vehicleId],
  );

  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip) return;
    const activeBtn = strip.children[active] as HTMLElement | undefined;
    if (!activeBtn) return;
    // scrollIntoView no iOS empurra a página; rolamos só a faixa.
    const left =
      activeBtn.offsetLeft - (strip.clientWidth - activeBtn.clientWidth) / 2;
    strip.scrollTo({
      left: Math.max(0, left),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [active]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || total < 2) return;

    function onScroll() {
      const el = scrollerRef.current;
      if (!el) return;
      const width = el.clientWidth;
      if (width <= 0) return;
      const index = Math.round(el.scrollLeft / width);
      setActive(Math.min(Math.max(index, 0), total - 1));
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [total]);

  const goTo = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const next = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
    scroller.scrollTo({
      left: next * scroller.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    setActive(next);
  }, [total]);

  useEffect(() => {
    if (zoomOpen || total < 2) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(active - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(active + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, goTo, total, zoomOpen]);

  if (total === 0) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden border border-white/10 bg-ink">
        <VehicleImage
          src={null}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden border border-white/10 bg-ink">
        <ul
          ref={scrollerRef}
          className="gallery-strip absolute inset-0 flex snap-x snap-mandatory overflow-x-auto scrollbar-hide"
          aria-label={`Fotos de ${alt}`}
        >
          {photos.map((photo, index) => {
            return (
              <li
                key={photo.id}
                className="relative h-full w-full min-w-full shrink-0 snap-center snap-always bg-asphalt"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActive(index);
                    setZoomOpen(true);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    void downloadJpg(photo.id);
                  }}
                  aria-label={`Ampliar foto ${index + 1} de ${total}`}
                  className="absolute inset-0 z-[1] cursor-zoom-in [-webkit-touch-callout:none]"
                >
                  <span className="sr-only">Ampliar</span>
                </button>
                {shouldLoadGallerySlide(index, active) ? (
                  <VehicleImage
                    src={galleryPreviewSrc(photo)}
                    alt={vehiclePhotoAlt(alt, index, total)}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    srcSet={galleryPreviewSrcSet(photo)}
                    priority={index === 0}
                    className="object-cover [-webkit-touch-callout:none]"
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-asphalt"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ul>

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label="Foto anterior"
              disabled={active === 0}
              className="absolute left-[max(0.5rem,env(safe-area-inset-left,0px))] top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/15 bg-asphalt/80 text-cream backdrop-blur transition touch-manipulation hover:border-brand active:border-brand disabled:opacity-30"
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="Próxima foto"
              disabled={active === total - 1}
              className="absolute right-[max(0.5rem,env(safe-area-inset-right,0px))] top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/15 bg-asphalt/80 text-cream backdrop-blur transition touch-manipulation hover:border-brand active:border-brand disabled:opacity-30"
            >
              <Arrow direction="right" />
            </button>

            <span
              className="pointer-events-none absolute right-2 top-2 z-[2] bg-asphalt/80 px-2 py-1 text-xs font-medium text-cream backdrop-blur"
              aria-live="polite"
            >
              {active + 1}/{total}
            </span>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => {
            const photo = photos[active];
            if (photo) void downloadJpg(photo.id);
          }}
          disabled={downloadId !== null}
          className="absolute bottom-2 left-[max(0.5rem,env(safe-area-inset-left,0px))] z-[2] inline-flex h-11 items-center gap-1.5 border border-white/20 bg-asphalt/85 px-3 font-display text-[11px] font-semibold uppercase tracking-wide text-cream backdrop-blur touch-manipulation hover:border-brand disabled:opacity-60"
          aria-label="Baixar esta foto em JPG"
        >
          <DownloadIcon />
          {downloadId ? "Preparando…" : "Baixar JPG"}
        </button>
      </div>

      {total > 1 ? (
        <>
          <div
            ref={thumbsRef}
            className="mt-2 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-hide [-webkit-overflow-scrolling:touch]"
            role="tablist"
            aria-label="Miniaturas"
          >
            {photos.map((photo, index) => {
              return (
                <button
                  key={photo.id}
                  type="button"
                  role="tab"
                  onClick={() => goTo(index)}
                  aria-label={`Ver foto ${index + 1} de ${total}`}
                  aria-selected={index === active}
                  className={`relative h-14 w-[4.5rem] shrink-0 overflow-hidden border bg-asphalt transition touch-manipulation sm:h-16 sm:w-24 ${
                    index === active
                      ? "border-brand"
                      : "border-white/15 opacity-70 hover:opacity-100 active:opacity-100"
                  }`}
                >
                  <VehicleImage
                    src={galleryThumbSrc(photo)}
                    alt={vehiclePhotoAlt(alt, index, total)}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted lg:hidden">
            Deslize as fotos ou toque nas miniaturas · toque para ampliar
          </p>
          <p className="mt-1.5 hidden text-xs text-muted lg:block">
            Use as setas, o teclado ou as miniaturas · clique para ampliar
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted">
          <span className="lg:hidden">Toque na foto para ampliar</span>
          <span className="hidden lg:inline">Clique na foto para ampliar</span>
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        Baixar JPG salva a versão leve da galeria, em JPEG, para Marketplace e
        WhatsApp. A página continua em WebP.
      </p>

      {zoomOpen ? (
        <PhotoLightbox
          photos={photos}
          alt={alt}
          vehicleId={vehicleId}
          index={active}
          onIndexChange={(next) => {
            setActive(next);
            const scroller = scrollerRef.current;
            if (scroller) {
              scroller.scrollTo({
                left: next * scroller.clientWidth,
                behavior: "auto",
              });
            }
          }}
          onClose={() => setZoomOpen(false)}
        />
      ) : null}
    </div>
  );
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

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
