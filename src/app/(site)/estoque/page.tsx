import type { Metadata } from "next";
import { Suspense } from "react";
import {
  EstoqueBrowse,
  EstoqueBrowseFallback,
  type EstoqueSearchParams,
} from "@/components/site/EstoqueBrowse";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { Container, PageHeader } from "@/components/site/ui";
import { buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const revalidate = 120;

export const metadata: Metadata = buildPageMetadata({
  title: `Estoque | ${site.name}`,
  description: `Veículos seminovos disponíveis na ${site.name} — Aracruz, Vitória, Linhares, Serra, Vila Velha e região do ES. Procedência verificada e vistoria completa.`,
  path: "/estoque",
});

export default function EstoquePage({
  searchParams,
}: {
  searchParams: EstoqueSearchParams;
}) {
  return (
    <div className="py-10 lg:py-12">
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description="Vistoria e procedência em cada anúncio. Use os filtros para achar o seu."
        />

        <Suspense fallback={<EstoqueBrowseFallback />}>
          <EstoqueBrowse searchParams={searchParams} />
        </Suspense>

        <div className="mt-10">
          <WantedVehicleCta />
        </div>
      </Container>
    </div>
  );
}
