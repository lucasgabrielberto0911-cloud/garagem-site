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
  SERVICE_CITIES,
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
} from "@/lib/seo";
import { getFeaturedVehicles } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Seminovos no Espírito Santo | ${site.name}`,
  description:
    "Seminovos com procedência para Aracruz, Grande Vitória, Linhares, Guarapari, Cachoeiro, Colatina e região. Estoque no site e atendimento da Garagem pelo WhatsApp, todos os dias das 8h às 23h.",
  path: "/seminovos",
});

export default async function SeminovosHubPage() {
  const featured = await getFeaturedVehicles(8);
  const path = "/seminovos";

  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Seminovos", path },
        ])}
      />

      <Container>
        <PageHeader
          eyebrow={`${site.state} · loja digital`}
          title="Seminovos no Espírito Santo"
          description="A Garagem atende o Estado pelo site e WhatsApp — sem ponto físico obrigatório. Escolha a cidade para ver o estoque com texto local, ou vá direto aos anúncios."
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
            Cidades atendidas
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Mesmo estoque da loja digital. Cada página explica como compramos,
            vendemos e trocamos com quem está naquela cidade.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CITIES.map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/seminovos/${city.slug}`}
                  className="flex min-h-[88px] flex-col justify-center border border-white/10 bg-ink/60 px-4 py-4 transition hover:border-brand hover:bg-ink"
                >
                  <span className="font-display text-sm font-semibold uppercase tracking-wide text-cream">
                    {city.name}
                  </span>
                  <span className="mt-1 text-xs text-muted">
                    Seminovos em {city.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-cream">
                Em destaque agora
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                Recorte do estoque disponível — o mesmo que você vê em
                qualquer cidade.
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
          <p className="mt-4 text-center text-xs text-muted">
            Hub local: {absoluteUrl(path)}
          </p>
        </div>
      </Container>
    </div>
  );
}
