"use client";

import { useStockPendingOptional } from "@/components/site/StockPending";
import { STOCK_SORT_OPTIONS, stockSortLabel } from "@/lib/stock-query";

/** Ordenação fica no topo da lista de resultados, separada dos filtros. */
export function StockSortSelect({ value }: { value?: string }) {
  const { startTransition } = useStockPendingOptional();
  const current = STOCK_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as string)
    : "destaques";

  function change(next: string) {
    const search = new URLSearchParams(window.location.search);
    if (next === "destaques") search.delete("sort");
    else search.set("sort", next);
    search.delete("page");
    const query = search.toString();
    const href = query ? `/estoque?${query}` : "/estoque";
    startTransition(() => {
      window.history.pushState(null, "", href);
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <label
        htmlFor="estoque-ordem"
        className="sr-only font-display text-xs font-semibold uppercase tracking-wider text-cream/80 lg:not-sr-only"
      >
        Ordenar
      </label>
      <select
        id="estoque-ordem"
        value={current}
        onChange={(event) => change(event.target.value)}
        className="min-h-11 max-w-[11.5rem] border border-white/20 bg-asphalt py-1.5 pl-2.5 pr-7 text-base text-cream focus:border-brand focus-visible:ring-2 focus-visible:ring-brand lg:min-h-10 lg:max-w-none lg:py-2 lg:text-sm"
        aria-label={`Ordenar resultados: ${stockSortLabel(current)}`}
      >
        {STOCK_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
