import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { CityDirectory } from "@/components/site/CityDirectory";
import { Container, PageHeader } from "@/components/site/ui";
import { site } from "@/lib/site";
import {
  CITIES_DIRECTORY_PATH,
  breadcrumbJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Cidades atendidas no Espírito Santo | ${site.name}`,
  description:
    "Conheça as cidades atendidas pela Garagem no Espírito Santo e veja como funciona o atendimento online na sua região.",
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
          eyebrow={`${site.state} · loja digital`}
          title="Cidades atendidas no Espírito Santo"
          description="Encontre sua cidade e conheça o atendimento da Garagem na sua região. Nossa equipe atende pelo site e WhatsApp, todos os dias, das 8h às 23h."
        />

        <nav aria-label="Você está aqui" className="mt-4 text-center text-xs text-muted">
          <Link href="/" className="transition hover:text-cream">
            Início
          </Link>
          <span className="mx-2">/</span>
          <span className="text-cream">Cidades</span>
        </nav>

        <section className="mx-auto mt-10 max-w-3xl">
          <h2 className="font-display text-xl font-semibold text-cream">
            Atendimento na sua região
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Escolha um município abaixo para consultar as informações de
            atendimento local. Pelo WhatsApp, você pode combinar os próximos
            passos da visita, negociação e entrega com a equipe.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Já quer escolher um veículo? Conheça nossos{" "}
            <Link href="/seminovos" className="text-cream underline underline-offset-4 transition hover:text-brand">
              seminovos no Espírito Santo
            </Link>
            . O estoque é compartilhado entre as cidades atendidas.
          </p>
        </section>

        <div className="mt-6">
          <CityDirectory />
        </div>
      </Container>
    </div>
  );
}
