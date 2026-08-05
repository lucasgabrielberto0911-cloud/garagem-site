import type { Metadata } from "next";
import { Suspense } from "react";
import { StockFilters } from "@/components/site/StockFilters";
import { VehicleCard } from "@/components/site/VehicleCard";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { WhatsAppButton } from "@/components/site/ui";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getStockFacets, getStockVehicles } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Estoque | ${site.name}`,
  description: `Veículos seminovos disponíveis na ${site.name}, com procedência verificada e vistoria completa.`,
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
    <div className="px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Estoque
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
            Veículos disponíveis
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Todos os veículos passam por vistoria e checagem de procedência antes
            de entrar no estoque. Use os filtros para encontrar o seu.
          </p>
        </header>

        <div className="mt-8">
          <Suspense fallback={<div className="h-32 border border-white/10 bg-ink" />}>
            <StockFilters facets={facets} />
          </Suspense>
        </div>

        <p className="mt-6 text-xs uppercase tracking-wider text-muted">
          {vehicles.length}{" "}
          {vehicles.length === 1 ? "veículo encontrado" : "veículos encontrados"}
        </p>

        {vehicles.length === 0 ? (
          <div className="mt-6 border border-dashed border-white/15 bg-ink/40 px-6 py-16 text-center">
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
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}

        <div className="mt-12">
          <WantedVehicleCta />
        </div>
      </div>
    </div>
  );
}
