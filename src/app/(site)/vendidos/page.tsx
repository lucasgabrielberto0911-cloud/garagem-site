import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { InstaDeliveriesGrid } from "@/components/site/InstaDeliveriesGrid";
import { Container, PageHeader } from "@/components/site/ui";
import vendidosInstaData from "@/data/vendidos-insta.json";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import type { InstaDeliveryItem } from "@/lib/vendidos-insta";

const instaDeliveries: readonly InstaDeliveryItem[] = vendidosInstaData;

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Vendidos | ${site.name}`,
  description: "Fotos de clientes com os veículos vendidos pela Sua Garagem.",
  path: "/vendidos",
});

export default function VendidosPage() {
  return (
    <div className="py-10 lg:py-14">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Vendidos", path: "/vendidos" },
        ])}
      />

      <Container>
        <PageHeader eyebrow="Entregas" title="Vendidos" />

        <div className="mt-8" data-insta-deliveries="">
          <InstaDeliveriesGrid items={instaDeliveries} />
        </div>
      </Container>
    </div>
  );
}
