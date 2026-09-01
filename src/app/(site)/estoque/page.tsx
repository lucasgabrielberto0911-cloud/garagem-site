import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import {
  EstoqueBrowse,
  EstoqueBrowseFallback,
} from "@/components/site/EstoqueBrowse";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { Container, PageHeader } from "@/components/site/ui";
import { buildPageMetadata, itemListJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { getStockFacets, getStockPage } from "@/lib/vehicles";

export const revalidate = 120;

export const metadata: Metadata = buildPageMetadata({
  title: `Estoque | ${site.name}`,
  description: `Veículos seminovos disponíveis na ${site.name} — Aracruz, Vitória, Linhares, Serra, Vila Velha e região do ES. Procedência verificada e vistoria completa.`,
  path: "/estoque",
});

export default async function EstoquePage() {
  const [stock, facets] = await Promise.all([
    getStockPage({ page: 1 }),
    getStockFacets(),
  ]);

  return (
    <div className="py-10 lg:py-12">
      {stock.vehicles.length > 0 ? (
        <JsonLd
          data={itemListJsonLd(stock.vehicles, {
            name: `Estoque — ${site.name}`,
            path: "/estoque",
          })}
        />
      ) : null}
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description="Vistoria e procedência em cada anúncio. Use os filtros para achar o seu."
        />

        <Suspense fallback={<EstoqueBrowseFallback />}>
          <EstoqueBrowse initialStock={stock} facets={facets} />
        </Suspense>

        <div className="mt-10">
          <WantedVehicleCta description="Não achou no filtro? Diz o modelo e a faixa — a gente avisa no WhatsApp quando entrar no estoque." />
        </div>
      </Container>
    </div>
  );
}
