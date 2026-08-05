import type { Metadata } from "next";
import { Suspense } from "react";
import { StockFilters } from "@/components/site/StockFilters";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getStockFacets, getStockVehicles } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Estoque | ${site.name}`,
  description: `Veículos seminovos disponíveis na ${site.name}, com procedência verificada e vistoria completa.`,
  alternates: { canonical: "/estoque" },
};

type SearchParams = {
  q?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  maxPrice?: string;
  minYear?: string;
  maxKm?: string;
  sort?: string;
};

function positiveNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [vehicles, facets] = await Promise.all([
    getStockVehicles({
      q: searchParams.q,
      brand: searchParams.brand,
      transmission: searchParams.transmission,
      fuel: searchParams.fuel,
      maxPrice: positiveNumber(searchParams.maxPrice),
      minYear: positiveNumber(searchParams.minYear),
      maxKm: positiveNumber(searchParams.maxKm),
      sort: searchParams.sort,
    }),
    getStockFacets(),
  ]);

  const hasFilter = Boolean(
    searchParams.q ||
      searchParams.brand ||
      searchParams.transmission ||
      searchParams.fuel ||
      searchParams.maxPrice ||
      searchParams.minYear ||
      searchParams.maxKm,
  );

  return (
    <div className="py-12 lg:py-16">
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description="Todos os veículos passam por vistoria e checagem de procedência antes de entrar no estoque. Use os filtros para encontrar o seu."
        />

        <div className="mt-10">
          <Suspense
            fallback={<div className="h-32 border border-white/10 bg-ink" />}
          >
            <StockFilters facets={facets} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs uppercase tracking-wider text-muted">
          {vehicles.length}{" "}
          {vehicles.length === 1 ? "veículo encontrado" : "veículos encontrados"}
        </p>

        <div className="mt-6">
          {vehicles.length === 0 ? (
            <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-16 text-center">
              <p className="font-display text-lg font-semibold text-cream">
                {hasFilter
                  ? "Nenhum veículo com esses filtros"
                  : "Estoque sendo montado"}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                {hasFilter
                  ? "Tente ampliar a busca. Se você já sabe o que quer, a gente procura o veículo para você."
                  : "Estamos selecionando os próximos veículos. Diga o que você procura que buscamos para você."}
              </p>
              <WhatsAppButton className="mt-6" message={WHATSAPP_MESSAGES.general}>
                Quero avisar o que procuro
              </WhatsAppButton>
            </div>
          ) : (
            <VehicleGrid vehicles={vehicles} />
          )}
        </div>

        <div className="mt-14">
          <WantedVehicleCta />
        </div>
      </Container>
    </div>
  );
}
