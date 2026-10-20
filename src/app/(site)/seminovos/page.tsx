import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import {
  ActionRow,
  ButtonLink,
  Container,
  PageHeader,
} from "@/components/site/ui";
import { site } from "@/lib/site";
import {
  CITIES_DIRECTORY_PATH,
  breadcrumbJsonLd,
  buildPageMetadata,
  itemListJsonLd,
} from "@/lib/seo";
import { getFeaturedVehicles } from "@/lib/vehicles";
import { MAX_HOME_FEATURED } from "@/lib/featured";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Seminovos no Espírito Santo | ${site.name}`,
  description:
    "Encontre carros e motos seminovos no Espírito Santo. Veja os destaques da Garagem, consulte fotos e detalhes dos anúncios e negocie sua compra ou troca pelo WhatsApp.",
  path: "/seminovos",
});

export default async function SeminovosHubPage() {
  const featured = await getFeaturedVehicles(MAX_HOME_FEATURED);
  const path = "/seminovos";

  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Seminovos", path },
        ])}
      />
      {featured.length > 0 && (
        <JsonLd
          data={itemListJsonLd(featured, {
            name: `Seminovos no Espírito Santo — ${site.name}`,
            path,
          })}
        />
      )}

      <Container>
        <PageHeader
          eyebrow={`${site.state} · loja digital`}
          title="Seminovos no Espírito Santo"
          description="Encontre seu próximo carro ou moto na Garagem. Explore os destaques, confira fotos e detalhes de cada anúncio e converse com a equipe sobre compra ou troca."
        />

        <nav aria-label="Você está aqui" className="mt-4 text-xs text-muted">
          <Link href="/" className="transition hover:text-cream">
            Início
          </Link>
          <span className="mx-2">/</span>
          <span className="text-cream">Seminovos</span>
        </nav>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-cream">
            Escolha seu próximo seminovo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Consulte ano, quilometragem, câmbio e preço nas fichas dos veículos
            disponíveis. Para comparar todas as opções, acesse o estoque completo.
            Se pretende trocar, fale com a equipe sobre a avaliação do seu veículo.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Para saber como funciona o atendimento na sua região, veja as{" "}
            <Link href={CITIES_DIRECTORY_PATH} className="text-cream underline underline-offset-4 transition hover:text-brand">
              cidades atendidas pela Garagem
            </Link>
            .
          </p>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-cream">
                Em destaque agora
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                Veículos disponíveis em destaque. Abra um anúncio para conhecer
                os detalhes e falar com a equipe pelo WhatsApp.
              </p>
            </div>
            <ButtonLink href="/estoque" variant="outline" className="sm:shrink-0">
              Ver estoque completo
            </ButtonLink>
          </div>
          <div className="mt-6">
            {featured.length === 0 ? (
              <p className="border border-dashed border-white/15 bg-ink/40 px-5 py-8 text-center text-sm text-muted">
                Estoque sendo montado. Chame no WhatsApp e diga o que você
                procura.
              </p>
            ) : (
              <VehicleGrid
                vehicles={featured}
                priorityCount={2}
                returnTo={path}
              />
            )}
          </div>
        </section>

        <div className="mt-12">
          <ActionRow>
            <ButtonLink href="/estoque">Ver estoque</ButtonLink>
            <ButtonLink href="/vender" variant="outline">
              Quero vender ou trocar
            </ButtonLink>
          </ActionRow>
        </div>
      </Container>
    </div>
  );
}
