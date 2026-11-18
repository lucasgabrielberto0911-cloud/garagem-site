import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { CityDirectory } from "@/components/site/CityDirectory";
import {
  ActionRow,
  ButtonLink,
  Container,
  PageHeader,
  WhatsAppButton,
} from "@/components/site/ui";
import { SiteLeadHit } from "@/lib/funnel-events";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import {
  CITIES_DIRECTORY_PATH,
  breadcrumbJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Cidades atendidas no Espírito Santo | ${site.name}`,
  description:
    "Conheça as cidades atendidas pela Garagem no Espírito Santo. Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp.",
  path: CITIES_DIRECTORY_PATH,
});

export default function CidadesPage() {
  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Cidades", path: CITIES_DIRECTORY_PATH },
        ])}
      />

      <Container>
        <PageHeader
          eyebrow={`${site.state} · Linhares, Aracruz e Grande Vitória`}
          title="Cidades atendidas no Espírito Santo"
          description="Atendemos Linhares, Aracruz e Grande Vitória, além de outras regiões do estado. Combinamos o atendimento pelo WhatsApp, todos os dias, das 8h às 23h."
        />

        <nav aria-label="Você está aqui" className="mt-4 text-center text-xs text-cream/75">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center px-1 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Início
          </Link>
          <span className="mx-2">/</span>
          <span className="text-cream">Cidades</span>
        </nav>

        <section className="mx-auto mt-10 max-w-3xl">
          <h2 className="font-display text-xl font-semibold text-cream">
            Atendimento na sua região
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-cream/80">
            Escolha um município ou região abaixo para consultar as informações
            de atendimento local. Combinamos o atendimento pelo WhatsApp,
            incluindo vídeo do veículo, proposta, visita e entrega.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-cream/80">
            Já quer escolher um veículo? Conheça nossos{" "}
            <Link
              href="/seminovos"
              className="text-cream underline underline-offset-4 transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              seminovos no Espírito Santo
            </Link>
            . O estoque é compartilhado entre as cidades atendidas.
          </p>
        </section>

        <div className="mt-6">
          <CityDirectory />
        </div>

        <div className="mt-10">
          <ActionRow className="sm:flex-wrap">
            <SiteLeadHit contentName="Cidades atendidas">
              <WhatsAppButton
                trackingLabel="cidades"
                message={WHATSAPP_MESSAGES.general}
              >
                Falar no WhatsApp
              </WhatsAppButton>
            </SiteLeadHit>
            <ButtonLink href="/estoque" variant="outline">
              Ver estoque
            </ButtonLink>
          </ActionRow>
        </div>
      </Container>
    </div>
  );
}
