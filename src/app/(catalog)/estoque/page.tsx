import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { EstoqueBrowse } from "@/components/site/EstoqueBrowse";
import { StockCatalogGate } from "@/components/site/StockCatalogGate";
import { StockCatalogLinks } from "@/components/site/StockCatalogLinks";
import { StockFilters } from "@/components/site/StockFilters";
import { RecentlyViewedVehicles } from "@/components/site/RecentlyViewedVehicles";
import { StockFiltersSkeleton } from "@/components/site/StockFiltersSkeleton";
import { StockBrowseShell } from "@/components/site/StockPending";
import { Container, PageHeader } from "@/components/site/ui";
import { buildPageMetadata, itemListJsonLd } from "@/lib/seo";
import { ESTOQUE_SEO_TITLE, SEO_LOCAL_LOCATION } from "@/lib/seo-local";
import { site } from "@/lib/site";
import { getStockCatalogLinks, getStockFacets, getStockPage } from "@/lib/vehicles";

export const revalidate = 600;

export const metadata: Metadata = buildPageMetadata({
  title: ESTOQUE_SEO_TITLE,
  description: `Carros e motos seminovos da ${site.name} para quem compra em ${SEO_LOCAL_LOCATION} e região. Revisados, com garantia e documentação preparada.`,
  path: "/estoque",
});

export default async function EstoquePage() {
  const [stock, facets, catalog] = await Promise.all([
    getStockPage({ page: 1 }),
    getStockFacets(),
    getStockCatalogLinks(),
  ]);
  const listed = catalog.length > 0 ? catalog : stock.vehicles;

  return (
    <div data-stock-page="" className="stock-page stock-compact-opening py-4 lg:py-12">
      {listed.length > 0 ? (
        <JsonLd
          data={itemListJsonLd(listed, {
            name: `Estoque — ${site.name}`,
            path: "/estoque",
          })}
        />
      ) : null}
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description={`Seminovos revisados e com garantia em ${SEO_LOCAL_LOCATION}. Troca, financiamento e vídeo do carro pelo WhatsApp.`}
        />

        <RecentlyViewedVehicles />

        <StockBrowseShell
          filters={
            <Suspense
              fallback={<StockFiltersSkeleton facets={facets} />}
            >
              <StockFilters facets={facets} />
            </Suspense>
          }
          results={<EstoqueBrowse initialStock={stock} />}
        />

        <Suspense fallback={<StockCatalogLinks vehicles={catalog} />}>
          <StockCatalogGate>
            <StockCatalogLinks vehicles={catalog} />
          </StockCatalogGate>
        </Suspense>

      </Container>
    </div>
  );
}
