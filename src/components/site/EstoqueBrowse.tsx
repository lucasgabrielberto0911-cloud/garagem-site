import { Suspense } from "react";
import { SiteErrorNotice } from "@/components/site/SiteErrorNotice";
import { StockBrowseShell } from "@/components/site/StockPending";
import { StockFilters } from "@/components/site/StockFilters";
import { StockInfiniteList } from "@/components/site/StockInfiniteList";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { WhatsAppButton } from "@/components/site/ui";
import { WHATSAPP_MESSAGES } from "@/lib/site";
import { getStockFacets, getStockPage, parseStockFilters } from "@/lib/vehicles";

export type EstoqueSearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  accessory?: string;
  laudo?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  maxKm?: string;
  sort?: string;
  page?: string;
};

function buildReturnTo(params: EstoqueSearchParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || !value) continue;
    search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

function stockQuery(params: EstoqueSearchParams) {
  return {
    q: params.q,
    category: params.category,
    brand: params.brand,
    transmission: params.transmission,
    fuel: params.fuel,
    color: params.color,
    accessory: params.accessory,
    laudo: params.laudo,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minYear: params.minYear,
    maxYear: params.maxYear,
    maxKm: params.maxKm,
    sort: params.sort,
  };
}

export function EstoqueBrowseFallback() {
  return (
    <div className="mt-8 lg:grid lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="h-28 border border-white/10 bg-ink lg:h-[70vh]" />
      <div>
        <div className="skeleton mx-auto mt-5 h-3 w-40 lg:mx-0 lg:mt-0" />
        <div className="mt-4">
          <VehicleCardSkeletonGrid count={6} />
        </div>
      </div>
    </div>
  );
}

/** Busca o estoque no servidor — fica atrás de Suspense para o título pintar logo. */
export async function EstoqueBrowse({
  searchParams,
}: {
  searchParams: EstoqueSearchParams;
}) {
  const filters = parseStockFilters(searchParams, { page: 1 });
  const [stock, facets] = await Promise.all([
    getStockPage(filters),
    getStockFacets(),
  ]);

  const hasFilter = Boolean(
    searchParams.q ||
      searchParams.category ||
      searchParams.brand ||
      searchParams.transmission ||
      searchParams.fuel ||
      searchParams.color ||
      searchParams.accessory ||
      searchParams.laudo ||
      searchParams.minPrice ||
      searchParams.maxPrice ||
      searchParams.minYear ||
      searchParams.maxYear ||
      searchParams.maxKm,
  );

  const returnTo = buildReturnTo(searchParams);
  const filterKey = JSON.stringify(stockQuery(searchParams));

  return (
    <>
      {stock.error ? (
        <div className="mt-6">
          <SiteErrorNotice message="O estoque pode estar incompleto por uma falha temporária de conexão. Atualize a página em instantes." />
        </div>
      ) : null}

      <StockBrowseShell
        filters={
          <Suspense
            fallback={<div className="h-28 border border-white/10 bg-ink lg:h-[70vh]" />}
          >
            <StockFilters facets={facets} />
          </Suspense>
        }
        results={
          <>
            <p className="mt-5 text-center text-xs uppercase tracking-wider text-muted lg:mt-0 lg:text-left">
              {stock.total}{" "}
              {stock.total === 1 ? "veículo encontrado" : "veículos encontrados"}
              {stock.total > stock.vehicles.length
                ? " · role para ver todos"
                : ""}
            </p>

            <div className="mt-4">
              <StockInfiniteList
                key={filterKey}
                initialVehicles={stock.vehicles}
                total={stock.total}
                pageSize={stock.pageSize}
                query={stockQuery(searchParams)}
                returnTo={returnTo}
                empty={
                  <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-12 text-center">
                    <p className="font-display text-lg font-semibold text-cream">
                      {stock.error
                        ? "Não foi possível carregar o estoque"
                        : hasFilter
                          ? "Nenhum veículo com esses filtros"
                          : "Estoque sendo montado"}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                      {stock.error
                        ? "Tente novamente em alguns instantes. Se preferir, fale conosco no WhatsApp."
                        : hasFilter
                          ? "Tente ampliar a busca. Se você já sabe o que quer, a gente procura o veículo para você."
                          : "Estamos selecionando os próximos veículos. Diga o que você procura que buscamos para você."}
                    </p>
                    <WhatsAppButton className="mt-5" message={WHATSAPP_MESSAGES.general}>
                      Quero avisar o que procuro
                    </WhatsAppButton>
                  </div>
                }
              />
            </div>
          </>
        }
      />
    </>
  );
}
