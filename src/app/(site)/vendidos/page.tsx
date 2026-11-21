import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { InstaDeliveriesGrid } from "@/components/site/InstaDeliveriesGrid";
import { Container, WhatsAppButton } from "@/components/site/ui";
import vendidosInstaData from "@/data/vendidos-insta.json";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import {
  INSTA_DELIVERIES_EAGER_COUNT,
  type InstaDeliveryClientItem,
  type InstaDeliveryItem,
} from "@/lib/vendidos-insta";

const instaDeliveries: readonly InstaDeliveryClientItem[] = (
  vendidosInstaData as readonly InstaDeliveryItem[]
).map(({ id, brand, model, src, srcSmall, lqip, art }, index) => ({
  id,
  brand,
  model,
  src,
  srcSmall,
  lqip: index < INSTA_DELIVERIES_EAGER_COUNT ? null : lqip,
  art,
}));

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Vendidos | ${site.name}`,
  description: "Fotos de clientes com os veículos vendidos pela Garagem.",
  path: "/vendidos",
});

export default function VendidosPage() {
  return (
    <div className="relative overflow-hidden pb-14 pt-8 sm:pt-10 lg:pb-20 lg:pt-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,rgba(217,21,25,0.22),transparent_72%)] sm:h-80"
        aria-hidden="true"
      />

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Vendidos", path: "/vendidos" },
        ])}
      />

      <Container>
        <header className="text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-brand-light">
            Entregas
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-cream sm:text-5xl lg:text-6xl">
            Vendidos
          </h1>
          <div
            className="mx-auto mt-3.5 h-1 w-16 rounded-full bg-brand-gradient"
            aria-hidden="true"
          />
          <p className="mx-auto mt-3.5 max-w-xl text-balance text-base leading-relaxed text-muted sm:text-lg">
            Clientes que já saíram da Garagem de carro ou moto novos
          </p>
        </header>

        <div className="mt-8 sm:mt-10" data-insta-deliveries="">
          <InstaDeliveriesGrid items={instaDeliveries} />
        </div>

        <section
          aria-label="Falar com a Garagem no WhatsApp"
          className="mt-14 border-t border-white/10 pt-10 text-center sm:mt-16 sm:pt-12"
        >
          <p className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
            Quer ser o próximo?
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted sm:text-base">
            Fale com a gente no WhatsApp e combinamos o atendimento.
          </p>
          <div className="mt-6 flex justify-center">
            <WhatsAppButton
              size="lg"
              trackingLabel="vendidos"
              message="Oi! Vi os carros entregues na página Vendidos da Garagem e quero encontrar o meu."
              className="w-full rounded-md sm:w-auto"
            >
              Falar no WhatsApp
            </WhatsAppButton>
          </div>
        </section>
      </Container>
    </div>
  );
}
