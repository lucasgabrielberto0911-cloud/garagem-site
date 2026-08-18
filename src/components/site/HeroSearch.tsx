import Link from "next/link";
import { IconSearch } from "@/components/site/icons";
import { formatBrandName } from "@/lib/format";

/**
 * Formulário nativo GET — busca no estoque sem esperar hidratação.
 */
export function HeroSearch({ brands = [] }: { brands?: string[] }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <form
        action="/estoque"
        method="get"
        className="flex flex-col gap-2 border border-white/15 bg-asphalt/85 p-2 backdrop-blur-md transition focus-within:border-brand/60 sm:flex-row"
        role="search"
      >
        <label htmlFor="hero-busca" className="sr-only">
          Buscar por marca ou modelo
        </label>
        <div className="flex flex-1 items-center gap-2 px-3">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            id="hero-busca"
            type="search"
            name="q"
            placeholder="Busque por marca ou modelo"
            className="w-full bg-transparent py-3.5 text-base text-cream placeholder:text-muted focus:outline-none sm:py-2.5 sm:text-sm"
          />
        </div>
        <button
          type="submit"
          className="min-h-[48px] bg-brand px-6 py-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] touch-manipulation"
        >
          Buscar
        </button>
      </form>

      {brands.length > 0 ? (
        <div className="mt-3 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide sm:flex-wrap sm:justify-center sm:overflow-visible">
          <span className="shrink-0 text-xs uppercase tracking-wider text-muted">
            Marcas:
          </span>
          {brands.slice(0, 5).map((brand) => (
            <Link
              key={brand}
              href={`/estoque?q=${encodeURIComponent(brand)}`}
              className="inline-flex min-h-[40px] shrink-0 items-center border border-white/15 px-3 py-2 text-xs text-cream transition hover:border-brand hover:bg-white/5 touch-manipulation sm:min-h-0 sm:px-2.5 sm:py-1.5"
            >
              {formatBrandName(brand)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
