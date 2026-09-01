import Link from "next/link";
import { IconSearch } from "@/components/site/icons";
import { formatBrandName } from "@/lib/format";

const BUDGET_LINKS = [
  { label: "Até 50 mil", href: "/estoque?maxPrice=50000" },
  { label: "50 a 80 mil", href: "/estoque?minPrice=50000&maxPrice=80000" },
  { label: "80 a 120 mil", href: "/estoque?minPrice=80000&maxPrice=120000" },
  { label: "Acima de 120 mil", href: "/estoque?minPrice=120000" },
] as const;

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
            className="w-full bg-transparent py-3.5 text-base text-cream placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="min-h-[48px] bg-brand px-6 py-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] touch-manipulation"
        >
          Buscar
        </button>
      </form>

      <div className="mt-3 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide sm:flex-wrap sm:justify-center sm:overflow-visible">
        <span className="shrink-0 text-xs uppercase tracking-wider text-muted">
          Faixa:
        </span>
        {BUDGET_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex min-h-[44px] shrink-0 items-center border border-white/15 px-3 py-2 text-xs text-cream transition hover:border-brand hover:bg-white/5 touch-manipulation sm:px-2.5 sm:py-1.5"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {brands.length > 0 ? (
        <div className="mt-2 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide sm:flex-wrap sm:justify-center sm:overflow-visible">
          <span className="shrink-0 text-xs uppercase tracking-wider text-muted">
            Marcas:
          </span>
          {brands.slice(0, 5).map((brand) => (
            <Link
              key={brand}
              href={`/estoque?brand=${encodeURIComponent(brand)}`}
              className="inline-flex min-h-[44px] shrink-0 items-center border border-white/15 px-3 py-2 text-xs text-cream transition hover:border-brand hover:bg-white/5 touch-manipulation sm:px-2.5 sm:py-1.5"
            >
              {formatBrandName(brand)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
