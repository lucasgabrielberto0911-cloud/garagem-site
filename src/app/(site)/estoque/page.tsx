import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import {
  EstoqueBrowse,
  EstoqueBrowseFallback,
} from "@/components/site/EstoqueBrowse";
import { StockCatalogGate } from "@/components/site/StockCatalogGate";
import { StockCatalogLinks } from "@/components/site/StockCatalogLinks";
import { StockFilters } from "@/components/site/StockFilters";
import { StockFiltersSkeleton } from "@/components/site/StockFiltersSkeleton";
import { StockBrowseShell } from "@/components/site/StockPending";
import { Container, PageHeader } from "@/components/site/ui";
import { buildPageMetadata, itemListJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { getStockCatalogLinks, getStockFacets, getStockPage } from "@/lib/vehicles";

export const revalidate = 600;

export const metadata: Metadata = buildPageMetadata({
  title: `Estoque | ${site.name}`,
  description: `Veículos seminovos disponíveis na ${site.name} — Aracruz, Vitória, Linhares, Serra, Vila Velha e região do ES. Revisados, com garantia e documentação preparada.`,
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
    <div data-stock-page="" className="stock-page py-4 lg:py-12">
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
          description="Cada veículo é revisado e sai com garantia. A documentação vai preparada pra você. Filtre por marca, modelo, ano, preço, km ou câmbio e ordene a lista. Se não achar o modelo, peça o que você procura."
        />

        <StockBrowseShell
          filters={
            <Suspense
              fallback={<StockFiltersSkeleton facets={facets} />}
            >
              <StockFilters facets={facets} />
            </Suspense>
          }
          results={
            <Suspense fallback={<EstoqueBrowseFallback stock={stock} />}>
              <EstoqueBrowse initialStock={stock} />
            </Suspense>
          }
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
