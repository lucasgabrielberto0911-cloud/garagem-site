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
    <div className="flex items-center gap-2">
      <label
        htmlFor="estoque-ordem"
        className="font-display text-xs font-semibold uppercase tracking-wider text-muted"
      >
        Ordenar
      </label>
      <select
        id="estoque-ordem"
        value={current}
        onChange={(event) => change(event.target.value)}
        className="min-h-11 border border-white/15 bg-asphalt py-2 pl-2.5 pr-7 text-base text-cream outline-none transition focus:border-brand lg:min-h-10 lg:text-sm"
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
