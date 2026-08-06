import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteErrorNotice } from "@/components/site/SiteErrorNotice";
import { StockBrowseShell } from "@/components/site/StockPending";
import { StockFilters } from "@/components/site/StockFilters";
import { StockPagination } from "@/components/site/StockPagination";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getStockFacets, getStockPage } from "@/lib/vehicles";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Estoque | ${site.name}`,
  description: `Veículos seminovos disponíveis na ${site.name}, com procedência verificada e vistoria completa.`,
  alternates: { canonical: "/estoque" },
};

type SearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  maxKm?: string;
  sort?: string;
  page?: string;
};

function positiveNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildBaseQuery(params: SearchParams) {
  const search = new URLSearchParams();
  const keys: (keyof SearchParams)[] = [
    "q",
    "category",
    "brand",
    "transmission",
    "fuel",
    "minPrice",
    "maxPrice",
    "minYear",
    "maxYear",
    "maxKm",
    "sort",
  ];
  for (const key of keys) {
    const value = params[key];
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function buildReturnTo(params: SearchParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [stock, facets] = await Promise.all([
    getStockPage({
      q: searchParams.q,
      category: searchParams.category,
      brand: searchParams.brand,
      transmission: searchParams.transmission,
      fuel: searchParams.fuel,
      minPrice: positiveNumber(searchParams.minPrice),
      maxPrice: positiveNumber(searchParams.maxPrice),
      minYear: positiveNumber(searchParams.minYear),
      maxYear: positiveNumber(searchParams.maxYear),
      maxKm: positiveNumber(searchParams.maxKm),
      sort: searchParams.sort,
      page,
    }),
    getStockFacets(),
  ]);

  const hasFilter = Boolean(
    searchParams.q ||
      searchParams.category ||
      searchParams.brand ||
      searchParams.transmission ||
      searchParams.fuel ||
      searchParams.minPrice ||
      searchParams.maxPrice ||
      searchParams.minYear ||
      searchParams.maxYear ||
      searchParams.maxKm,
  );

  const baseQuery = buildBaseQuery(searchParams);
  const returnTo = buildReturnTo(searchParams);

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
                {stock.totalPages > 1
                  ? ` · página ${stock.page} de ${stock.totalPages}`
                  : ""}
              </p>

              <div className="mt-4">
                {stock.vehicles.length === 0 ? (
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
                ) : (
                  <VehicleGrid vehicles={stock.vehicles} returnTo={returnTo} />
                )}
              </div>

              <StockPagination
                page={stock.page}
                totalPages={stock.totalPages}
                total={stock.total}
                baseQuery={baseQuery}
              />
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
