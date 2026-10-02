import type { Facets } from "@/components/site/StockFilters";

/** Reserve o espaço dos filtros antes da hidratação, sem empurrar os anúncios. */
export function StockFiltersSkeleton({ facets }: { facets?: Facets }) {
  const rows = [
    "Cidade",
    "Faixa",
    ...(!facets || facets.brands.length > 0 ? ["Marca"] : []),
    ...(!facets || facets.transmissions.length > 0 ? ["Câmbio"] : []),
  ];

  return (
    <div role="status" aria-label="Carregando filtros">
      <div
        aria-hidden="true"
        className="border border-white/10 bg-ink p-4 sm:p-5 lg:h-[70dvh] lg:p-6"
      >
        <div className="mx-auto flex max-w-2xl gap-2 lg:flex-col lg:gap-3">
          <div className="h-12 flex-1 border border-white/10 bg-asphalt lg:flex-none" />
          <div className="h-12 w-[52px] bg-brand/20 sm:w-[96px] lg:w-full" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="stock-chip-bar mt-3 border border-white/10 bg-ink px-3 py-2.5 lg:hidden"
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
        <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto]">
          <div className="h-11 border border-white/15 bg-asphalt" />
          <div className="h-11 border border-white/15 bg-asphalt min-[360px]:w-[78px]" />
        </div>
      </div>
    </div>
  );
}
