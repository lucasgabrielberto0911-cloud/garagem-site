"use client";

import { useRef, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";

export function VehicleGallery({
  photos,
  alt,
}: {
  photos: { id: string; url: string }[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const current = photos[active];
  const total = photos.length;

  function previous() {
    if (total < 2) return;
    setActive((index) => (index - 1 + total) % total);
  }

  function next() {
    if (total < 2) return;
    setActive((index) => (index + 1) % total);
  }

  return (
    <div>
      <div
        className="relative aspect-[4/3] touch-pan-y select-none overflow-hidden border border-white/10 bg-ink"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
          touchDeltaX.current = 0;
        }}
        onTouchMove={(event) => {
          if (touchStartX.current === null) return;
          touchDeltaX.current =
            (event.touches[0]?.clientX ?? touchStartX.current) -
            touchStartX.current;
        }}
        onTouchEnd={() => {
          if (Math.abs(touchDeltaX.current) > 48) {
            if (touchDeltaX.current < 0) {
              next();
            } else {
              previous();
            }
          }
          touchStartX.current = null;
          touchDeltaX.current = 0;
        }}
      >
        <VehicleImage
          src={current?.url}
          alt={`${alt} — foto ${active + 1} de ${Math.max(total, 1)}`}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover transition-opacity duration-300"
        />

        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={previous}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/15 bg-asphalt/75 text-cream backdrop-blur transition hover:border-brand sm:flex"
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/15 bg-asphalt/75 text-cream backdrop-blur transition hover:border-brand sm:flex"
            >
              <Arrow direction="right" />
            </button>

            <span className="absolute right-3 top-3 bg-asphalt/80 px-3 py-1.5 text-xs font-medium text-cream backdrop-blur">
              {active + 1} / {total}
            </span>

            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Ver foto ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    active === index ? "w-6 bg-brand" : "w-1.5 bg-white/55"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <ul className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-6 sm:gap-3 sm:overflow-visible">
          {photos.map((photo, index) => (
            <li key={photo.id} className="w-[76px] shrink-0 snap-start sm:w-auto">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                aria-current={index === active}
                className={`relative block aspect-[4/3] w-full overflow-hidden border bg-ink transition ${
                  index === active
                    ? "border-brand"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <VehicleImage
                  src={photo.url}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {total > 1 ? (
        <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted sm:hidden">
          Deslize para ver mais fotos
        </p>
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
