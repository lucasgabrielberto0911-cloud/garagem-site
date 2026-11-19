import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { EstoqueBrowse } from "@/components/site/EstoqueBrowse";
import { SeoInternalLinks } from "@/components/site/SeoInternalLinks";
import { StockCatalogGate } from "@/components/site/StockCatalogGate";
import { StockCatalogLinks } from "@/components/site/StockCatalogLinks";
import { RecentlyViewedVehicles } from "@/components/site/RecentlyViewedVehicles";
import { Container, PageHeader } from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata, itemListJsonLd } from "@/lib/seo";
import { ESTOQUE_SEO_TITLE, SEO_LOCAL_LOCATION } from "@/lib/seo-local";
import { site } from "@/lib/site";
import { getStockCatalogLinks, getStockPage } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: ESTOQUE_SEO_TITLE,
  description: `Carros e motos seminovos da ${site.name} para quem compra em ${SEO_LOCAL_LOCATION} e região. Revisados, com garantia e documentação preparada.`,
  path: "/estoque",
});

export default async function EstoquePage() {
  const [stock, catalog] = await Promise.all([
    getStockPage({ page: 1 }),
    getStockCatalogLinks(),
  ]);
  const listed = catalog.length > 0 ? catalog : stock.vehicles;

  return (
    <div data-stock-page="" className="stock-page stock-compact-opening py-2 lg:pt-2 lg:pb-6">
      {listed.length > 0 ? (
        <JsonLd
          data={itemListJsonLd(listed, {
            name: `Estoque — ${site.name}`,
            path: "/estoque",
          })}
        />
      ) : null}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Estoque", path: "/estoque" },
        ])}
      />
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description={`Seminovos revisados e com garantia em ${SEO_LOCAL_LOCATION}. Troca, financiamento e vídeo do carro pelo WhatsApp.`}
        />

        <div className="mt-3 lg:mt-4">
          <EstoqueBrowse initialStock={stock} />
        </div>

        <RecentlyViewedVehicles />

        <Suspense fallback={<StockCatalogLinks vehicles={catalog} />}>
          <StockCatalogGate>
            <StockCatalogLinks vehicles={catalog} />
          </StockCatalogGate>
        </Suspense>
        <SeoInternalLinks />
      </Container>
    </div>
  );
}
