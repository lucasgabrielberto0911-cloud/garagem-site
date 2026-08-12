import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import {
  ActionRow,
  ButtonLink,
  Container,
  PageHeader,
  WhatsAppButton,
} from "@/components/site/ui";
import { PHONES, WHATSAPP_MESSAGES, site } from "@/lib/site";
import {
  SERVICE_CITIES,
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  faqJsonLd,
  getServiceCity,
} from "@/lib/seo";

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
    description: `Seminovos com procedência para quem está em ${city.name} e região. Compra, venda, troca e financiamento com atendimento online da ${site.name}.`,
    path: `/seminovos/${city.slug}`,
  });
}

export default function SeminovosCidadePage({
  params,
}: {
  params: Params;
}) {
  const city = getServiceCity(params.cidade);
  if (!city) notFound();

  const path = `/seminovos/${city.slug}`;
  const faqs = [
    {
      question: `A Garagem atende quem está em ${city.name}?`,
      answer: `Sim. Atendemos clientes em ${city.name} e região por WhatsApp e telefone, com avaliação, fotos, vídeos e orientação de documentação — tudo online, todos os dias das 8h às 23h.`,
    },
    {
      question: "Como funciona a compra de um seminovo à distância?",
      answer:
        "Você escolhe no estoque, tira dúvidas pelo WhatsApp, recebe detalhes e vídeos do veículo e avança na proposta com transparência. A transferência e a documentação são acompanhadas pela equipe.",
    },
    {
      question: "Posso dar meu carro na troca?",
      answer:
        "Pode. Envie os dados do seu veículo pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
    },
  ];

  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Estoque", path: "/estoque" },
          { name: `Seminovos em ${city.name}`, path },
        ])}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      <Container>
        <PageHeader
          eyebrow={`${city.name} · ${site.state}`}
          title={`Seminovos em ${city.name}`}
          description={`A ${site.name} atende ${city.name} e região com seminovos vistoriados, negociação clara e atendimento online — compra, venda, troca e financiamento.`}
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
            <p>
              Se você está em <strong className="text-cream">{city.name}</strong>{" "}
              e procura um seminovo com procedência, a {site.name} concentra o
              atendimento no digital: estoque atualizado no site, conversa direta
              no WhatsApp e suporte até a documentação.
            </p>
            <p>
              Atendemos também Vitória, Linhares, Aracruz e demais cidades do{" "}
              {site.state}. O horário é todos os dias, das 8h às 23h.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Estoque com fotos e ficha técnica</li>
              <li>Avaliação para venda ou troca</li>
              <li>Orientação de financiamento</li>
              <li>Canais oficiais: WhatsApp {PHONES[0].label}</li>
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
            {SERVICE_CITIES.filter((item) => item.slug !== city.slug).map(
              (item) => (
                <Link
                  key={item.slug}
                  href={`/seminovos/${item.slug}`}
                  className="border border-white/15 px-3 py-2 text-xs uppercase tracking-wider text-muted transition hover:border-brand hover:text-cream"
                >
                  Seminovos em {item.name}
                </Link>
              ),
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
            Página de referência local: {absoluteUrl(path)}
          </p>
        </div>
      </Container>
    </div>
  );
}
