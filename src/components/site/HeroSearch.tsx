"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconSearch } from "@/components/site/icons";
import { formatBrandName } from "@/lib/format";
import { trackSearch } from "@/lib/meta-pixel";

const BUDGET_LINKS = [
  { label: "Até R$ 50 mil", href: "/estoque?maxPrice=50000" },
  { label: "R$ 50 mil a R$ 80 mil", href: "/estoque?minPrice=50000&maxPrice=80000" },
  { label: "R$ 80 mil a R$ 120 mil", href: "/estoque?minPrice=80000&maxPrice=120000" },
  { label: "Acima de R$ 120 mil", href: "/estoque?minPrice=120000" },
] as const;

const CHIP_CLASS =
  "inline-flex min-h-[44px] sm:min-h-0 sm:h-8 shrink-0 items-center border border-white/15 bg-asphalt/80 px-3 sm:px-2.5 font-body text-xs font-medium text-cream/90 transition hover:border-brand hover:bg-white/5 hover:text-cream active:border-brand active:bg-white/5 touch-manipulation whitespace-nowrap";

/**
 * Formulário nativo GET — busca no estoque sem esperar hidratação.
 */
export function HeroSearch({
  brands = [],
  className = "",
}: {
  brands?: string[];
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [brands]);

  return (
    <div className={`w-full ${className}`.trim()}>
      <form
        action="/estoque"
        method="get"
        onSubmit={(event) => {
          const term = new FormData(event.currentTarget).get("q");
          const search = String(term ?? "").trim();
          if (search) {
            trackSearch({ content_ids: [], search_string: search });
          }
        }}
        className="flex flex-row items-center gap-1.5 border border-white/15 bg-asphalt/95 p-1 transition focus-within:border-brand/60 sm:gap-2 sm:p-1.5 sm:bg-asphalt/85 sm:backdrop-blur-md"
        role="search"
      >
        <label htmlFor="hero-busca" className="sr-only">
          Buscar por marca ou modelo
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 sm:px-2.5">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            id="hero-busca"
            type="search"
            name="q"
            placeholder="Busque por marca ou modelo"
            className="w-full min-w-0 bg-transparent py-1.5 font-body text-sm text-cream placeholder:text-muted/80 focus:outline-none sm:py-2.5 sm:text-base"
          />
        </div>
        <button
          type="submit"
          className="min-h-[52px] shrink-0 bg-brand px-4 font-display text-sm font-semibold uppercase tracking-normal text-cream transition hover:bg-brand-dark touch-manipulation sm:px-5 sm:tracking-wide"
        >
          Buscar
        </button>
      </form>

      <div className="relative -mx-4 mt-2 sm:mx-0 sm:mt-2.5">
        {/* Fade indicador de rolagem à esquerda */}
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-asphalt to-transparent transition-opacity duration-200 sm:hidden ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="chip-scroll hero-chips flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 py-0.5 sm:gap-2 sm:px-0 sm:py-0"
        >
          <span className="sr-only sm:not-sr-only sm:shrink-0 sm:font-display sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wider sm:text-muted">
            Faixa:
          </span>
          {BUDGET_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={CHIP_CLASS}
            >
              {item.label}
            </Link>
          ))}

          {brands.length > 0 ? (
            <>
              <span
                className="mx-0.5 h-4 w-px shrink-0 bg-white/20 self-center sm:hidden"
                aria-hidden="true"
              />
              <span className="sr-only sm:not-sr-only sm:shrink-0 sm:font-display sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wider sm:text-muted sm:ml-1">
                Marcas:
              </span>
              {brands.slice(0, 5).map((brand) => (
                <Link
                  key={brand}
                  href={`/estoque?brand=${encodeURIComponent(brand)}`}
                  prefetch={false}
                  className={CHIP_CLASS}
                >
                  {formatBrandName(brand)}
                </Link>
              ))}
            </>
          ) : null}

          {/* Espaçador final para manter 16px de folga após o último chip no mobile */}
          <span className="shrink-0 w-2 sm:hidden" aria-hidden="true" />
        </div>

        {/* Fade indicador de rolagem à direita */}
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-14 bg-gradient-to-l from-asphalt via-asphalt/90 to-transparent transition-opacity duration-200 sm:hidden ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
