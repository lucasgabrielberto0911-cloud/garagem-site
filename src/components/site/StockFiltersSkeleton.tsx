import type { Facets } from "@/components/site/StockFilters";

/** Reserve o espaço dos filtros antes da hidratação, sem empurrar os anúncios. */
export function StockFiltersSkeleton(_props: { facets?: Facets }) {
  const rows = [
    "Atalhos",
  ];

  return (
    <div role="status" aria-label="Carregando filtros">
      <div
        aria-hidden="true"
        className="border-0 bg-transparent p-0 lg:border lg:border-white/10 lg:bg-ink lg:h-[34rem] lg:p-5"
      >
        <div className="mx-auto max-w-2xl">
          <div className="h-11 border border-white/10 bg-asphalt lg:h-[48px]" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="stock-chip-bar mt-2 border border-white/10 bg-ink px-2.5 py-2 lg:hidden"
      >
        {rows.map((label) => (
          <div key={label} className="stock-chip-row">
            <p className="stock-chip-label">{label}</p>
            <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
              <span className="h-11 w-20 shrink-0 border border-white/10 bg-white/5" />
              <span className="h-11 w-20 shrink-0 border border-white/10 bg-white/5" />
            </div>
          </div>
        ))}
        <div className="mt-2">
          <div className="h-11 border border-white/15 bg-asphalt" />
        </div>
      </div>
    </div>
  );
}
