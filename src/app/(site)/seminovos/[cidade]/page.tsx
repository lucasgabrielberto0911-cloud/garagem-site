import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import {
  ActionRow,
  ButtonLink,
  Container,
  PageHeader,
  WhatsAppButton,
} from "@/components/site/ui";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import {
  SERVICE_CITIES,
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  faqJsonLd,
  getServiceCity,
  otherServiceCities,
  serviceCityJsonLd,
} from "@/lib/seo";
import { getFeaturedVehicles } from "@/lib/vehicles";

export const revalidate = 3600;

type Params = { cidade: string };

export function generateStaticParams() {
  return SERVICE_CITIES.map((c) => ({ cidade: c.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const city = getServiceCity(params.cidade);
  if (!city) return {};
  return buildPageMetadata({
    title: `Seminovos em ${city.name} | ${site.name}`,
    description: city.metaDescription,
    path: `/seminovos/${city.slug}`,
  });
}

export default async function SeminovosCidadePage({
  params,
}: {
  params: Params;
}) {
  const city = getServiceCity(params.cidade);
  if (!city) notFound();

  const path = `/seminovos/${city.slug}`;
  const nearby = otherServiceCities(city.slug);
  const faqs = city.faqs.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));
  const featured = await getFeaturedVehicles(8);

  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Estoque", path: "/estoque" },
          { name: `Seminovos em ${city.name}`, path },
        ])}
      />
      <JsonLd data={serviceCityJsonLd(city)} />
      <JsonLd data={faqJsonLd(faqs)} />

      <Container>
        <PageHeader
          eyebrow={`${city.name} · ${site.state}`}
          title={`Seminovos em ${city.name}`}
          description={city.lead}
        />

        <nav
          aria-label="Você está aqui"
          className="mt-4 text-xs text-muted"
        >
          <Link href="/" className="transition hover:text-cream">
            Início
          </Link>
          <span className="mx-2">/</span>
          <Link href="/estoque" className="transition hover:text-cream">
            Estoque
          </Link>
          <span className="mx-2">/</span>
          <span className="text-cream">{city.name}</span>
        </nav>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5 text-sm leading-relaxed text-muted">
            {city.paragraphs.map((text) => (
              <p key={text.slice(0, 40)}>{text}</p>
            ))}
            <ul className="list-disc space-y-2 pl-5">
              {city.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <aside className="border border-white/10 bg-ink p-5 sm:p-6">
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Fale com a Garagem
            </p>
            <p className="mt-2 text-sm text-muted">
              Conte o que você procura em {city.name} — modelo, faixa de preço
              ou troca — que a gente responde pelo WhatsApp.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <WhatsAppButton
                message={`${WHATSAPP_MESSAGES.general} Estou em ${city.name}.`}
              >
                Chamar no WhatsApp
              </WhatsAppButton>
              <ButtonLink href="/estoque" variant="outline">
                Ver estoque completo
              </ButtonLink>
            </div>
          </aside>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-cream">
                Estoque disponível agora
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                O mesmo estoque da loja digital — atendemos {city.name} pelo
                WhatsApp.
              </p>
            </div>
            <ButtonLink href="/estoque" variant="outline" className="sm:shrink-0">
              Ver todos em {city.name}
            </ButtonLink>
          </div>
          <div className="mt-6">
            {featured.length === 0 ? (
              <p className="border border-dashed border-white/15 bg-ink/40 px-5 py-8 text-center text-sm text-muted">
                Estoque sendo montado. Chame no WhatsApp e diga o que você
                procura em {city.name}.
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

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-cream">
            Dúvidas rápidas — {city.name}
          </h2>
          <div className="mt-5 space-y-3">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group border border-white/10 bg-ink open:border-brand/40"
              >
                <summary className="cursor-pointer list-none px-4 py-3.5 font-display text-sm font-semibold text-cream marker:content-none">
                  {item.question}
                </summary>
                <p className="border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-muted">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-cream">
            Outras cidades
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {nearby.map((item) => (
              <Link
                key={item.slug}
                href={`/seminovos/${item.slug}`}
                className="border border-white/15 px-3 py-2 text-xs uppercase tracking-wider text-muted transition hover:border-brand hover:text-cream"
              >
                Seminovos em {item.name}
              </Link>
            ))}
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
            Página de referência local: {absoluteUrl(path)}
          </p>
        </div>
      </Container>
    </div>
  );
}
