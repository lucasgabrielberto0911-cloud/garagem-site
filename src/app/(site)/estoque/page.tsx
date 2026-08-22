import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteErrorNotice } from "@/components/site/SiteErrorNotice";
import { StockBrowseShell } from "@/components/site/StockPending";
import { StockFilters } from "@/components/site/StockFilters";
import { StockInfiniteList } from "@/components/site/StockInfiniteList";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { buildPageMetadata } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getStockFacets, getStockPage, parseStockFilters } from "@/lib/vehicles";

export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: `Estoque | ${site.name}`,
  description: `Veículos seminovos disponíveis na ${site.name} — Aracruz, Vitória, Linhares e região do ES. Procedência verificada e vistoria completa.`,
  path: "/estoque",
});

type SearchParams = {
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

function buildReturnTo(params: SearchParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || !value) continue;
    search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

function stockQuery(params: SearchParams) {
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

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: SearchParams;
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
    <div className="py-10 lg:py-12">
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description="Vistoria e procedência em cada anúncio. Use os filtros para achar o seu."
        />

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

        <div className="mt-10">
          <WantedVehicleCta />
        </div>
      </Container>
    </div>
  );
}
