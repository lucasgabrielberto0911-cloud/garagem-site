"use client";

import { useEffect, useRef, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { PhotoLightbox } from "@/components/site/PhotoLightbox";

/**
 * Galeria em faixa horizontal (snap). Carrega só a foto ativa ±1.
 */
export function VehicleGallery({
  photos,
  alt,
}: {
  photos: { id: string; url: string }[];
  alt: string;
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const total = photos.length;

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

  function goTo(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const next = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
    scroller.scrollTo({
      left: next * scroller.clientWidth,
      behavior: "smooth",
    });
    setActive(next);
  }

  if (total === 0) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden border border-white/10 bg-ink">
        <VehicleImage
          src={null}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          quality={70}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden border border-white/10 bg-ink">
        <ul
          ref={scrollerRef}
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide"
          aria-label={`Fotos de ${alt}`}
        >
          {photos.map((photo, index) => {
            const near = Math.abs(index - active) <= 1;
            return (
              <li
                key={photo.id}
                className="relative aspect-[16/10] w-full shrink-0 snap-center bg-asphalt"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActive(index);
                    setZoomOpen(true);
                  }}
                  aria-label={`Ampliar foto ${index + 1} de ${total}`}
                  className="absolute inset-0 z-[1] cursor-zoom-in"
                >
                  <span className="sr-only">Ampliar</span>
                </button>
                {near ? (
                  <VehicleImage
                    src={photo.url}
                    alt={`${alt} — foto ${index + 1} de ${total}`}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    quality={index === 0 ? 75 : 68}
                    priority={index === 0}
                    className="object-cover"
                  />
                ) : null}
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
              className="absolute left-2 top-1/2 z-[2] hidden h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/15 bg-asphalt/80 text-cream backdrop-blur transition hover:border-brand disabled:opacity-30 sm:flex"
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="Próxima foto"
              disabled={active === total - 1}
              className="absolute right-2 top-1/2 z-[2] hidden h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/15 bg-asphalt/80 text-cream backdrop-blur transition hover:border-brand disabled:opacity-30 sm:flex"
            >
              <Arrow direction="right" />
            </button>

            <span className="pointer-events-none absolute right-2 top-2 z-[2] bg-asphalt/80 px-2 py-1 text-xs font-medium text-cream backdrop-blur">
              {active + 1}/{total}
            </span>

            {total <= 8 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[2] flex justify-center gap-1">
                {photos.map((photo, index) => (
                  <span
                    key={photo.id}
                    className={`h-1 rounded-full transition-all ${
                      active === index ? "w-5 bg-brand" : "w-1 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <p className="mt-1.5 text-xs text-muted">
          Deslize para o lado · toque para ampliar
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">Toque na foto para ampliar</p>
      )}

      {zoomOpen ? (
        <PhotoLightbox
          photos={photos}
          alt={alt}
          index={active}
          onIndexChange={(index) => {
            setActive(index);
            goTo(index);
          }}
          onClose={() => setZoomOpen(false)}
        />
      ) : null}
    </div>
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
