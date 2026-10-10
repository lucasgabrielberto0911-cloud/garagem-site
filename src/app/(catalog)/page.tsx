import Link from "next/link";
import { Suspense } from "react";
import { preload } from "react-dom";
import { JsonLd } from "@/components/JsonLd";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { SiteWordmark } from "@/components/site/SiteWordmark";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { GoogleReviewsBadge } from "@/components/site/GoogleReviewsBadge";
import { HeroSearch } from "@/components/site/HeroSearch";
import { StatsBar, StatsBarSkeleton } from "@/components/site/StatsBar";
import { Testimonials } from "@/components/site/Testimonials";
import { TrustBadges } from "@/components/site/TrustBadges";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { RecentlyViewedVehicles } from "@/components/site/RecentlyViewedVehicles";
import { SiteLeadHit } from "@/components/site/VehiclePixel";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import {
  ActionRow,
  ButtonLink,
  Container,
  Section,
  SectionHeading,
  WhatsAppButton,
} from "@/components/site/ui";
import {
  IconArrowRight,
  IconClipboardCheck,
  IconClock,
  IconHandshake,
  IconInstagram,
  IconMapPin,
  IconShieldCheck,
} from "@/components/site/icons";
import { buildPageMetadata, itemListJsonLd, localBusinessJsonLd, websiteJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { googleReviewsReady } from "@/lib/google-reviews";
import { getPublishedFaq, getSiteContent } from "@/lib/site-content";
import { getPublicSite } from "@/lib/site-settings";
import {
  getFeaturedVehicles,
  getStockBrands,
  getTestimonials,
} from "@/lib/vehicles";
import { MAX_HOME_FEATURED } from "@/lib/featured";
import { HOME_SEO_TITLE, SEO_LOCAL_LOCATION } from "@/lib/seo-local";

export const revalidate = 600;

export const metadata = buildPageMetadata({
  title: HOME_SEO_TITLE,
  description: `Seminovos com procedência em ${SEO_LOCAL_LOCATION} e região. Escolha no site, peça vídeo no WhatsApp e marque visita. Troca e financiamento na Garagem.`,
  path: "/",
});

const REASONS = [
  {
    Icon: IconClipboardCheck,
    title: "Revisão com garantia",
    text: "A gente revisa cada veículo antes de anunciar. O que a gente viu, conta pra você no atendimento.",
  },
  {
    Icon: IconShieldCheck,
    title: "Documentação pronta",
    text: "A gente olha o histórico, os débitos e as restrições antes. A documentação vai 100% preparada, pra você ter mais tranquilidade.",
  },
  {
    Icon: IconHandshake,
    title: "Negociação clara",
    text: "O preço está no anúncio. Financiamento em até 60x e cartão em até 18x — a parcela o consultor calcula no WhatsApp.",
  },
] as const;

const HERO_WORDMARK = "/branding/logo-wordmark.webp";

export default async function HomePage() {
  // O LCP no celular é a foto do carro, não o wordmark. Prioridade baixa
  // para o logo não dividir a rede lenta com a capa.
  preload(HERO_WORDMARK, { as: "image", fetchPriority: "low" });

  const [featured, brands, testimonials, publicSite, siteContent, faqItems] =
    await Promise.all([
    getFeaturedVehicles(MAX_HOME_FEATURED),
    getStockBrands(5),
    getTestimonials(6),
    getPublicSite(),
    getSiteContent(),
    getPublishedFaq(),
  ]);

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      {featured.length > 0 ? (
        <JsonLd
          data={itemListJsonLd(featured, {
            name: `Destaques — ${site.name}`,
            path: "/",
          })}
        />
      ) : null}
      {testimonials.filter((item) => !String(item.id).startsWith("seed-")).length > 0 ? (
        <JsonLd
          data={localBusinessJsonLd(
            publicSite,
            testimonials
              .filter((item) => !String(item.id).startsWith("seed-"))
              .map((item) => ({
                name: item.name,
                city: item.city,
                message: item.message,
                rating: item.rating,
              })),
            siteContent.google,
          )}
        />
      ) : null}

      {/* 1. HERO — o que a loja é, e o único WhatsApp */}
      <section className="hero-red-black relative isolate overflow-hidden">
        <div className="hero-color-field" aria-hidden="true">
          <span className="hero-red-orb hero-red-orb-1" />
          <span className="hero-red-orb hero-red-orb-2" />
        </div>
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-16 bg-gradient-to-t from-asphalt to-transparent"
          aria-hidden="true"
        />

        <Container className="py-4 sm:py-6 lg:py-7">
          <div className="flex flex-col gap-2.5 sm:gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="hero-text min-w-0 max-w-2xl">
              <div className="hero-brand">
                <SiteWordmark size="hero" />
              </div>
              <h1 className="mt-3 font-display text-lg font-semibold leading-snug tracking-tight text-cream sm:mt-3 sm:text-3xl sm:leading-[1.12] lg:text-[2rem]">
                Seminovos com procedência em {SEO_LOCAL_LOCATION}.
              </h1>
              <ul className="mt-3 flex max-w-lg flex-col gap-2 border-l-2 border-brand/60 pl-3 text-sm leading-snug text-cream sm:gap-1.5 sm:border-0 sm:pl-0 sm:text-base">
                <li>A gente revisa cada veículo, e ele sai com garantia.</li>
                <li>A documentação vai 100% preparada, pra você ter mais tranquilidade.</li>
              </ul>
            </div>

            <div className="hero-cta flex w-full shrink-0 flex-col gap-2.5 sm:max-w-xs lg:max-w-sm">
              <WhatsAppButton
                size="lg"
                className="w-full"
                trackingLabel="home-hero"
                message={WHATSAPP_MESSAGES.help}
              >
                Falar no WhatsApp
              </WhatsAppButton>
              <ButtonLink href="/estoque" size="lg" className="w-full">
                Ver estoque
              </ButtonLink>
              <p className="text-center text-sm font-medium leading-none text-cream">
                {site.whatsappLabel}
              </p>
            </div>
          </div>

          <div className="hero-stats mx-auto mt-4 hidden w-full max-w-2xl sm:mt-8 sm:block lg:mx-0">
            <Suspense fallback={<StatsBarSkeleton />}>
              <StatsBar />
            </Suspense>
          </div>
        </Container>
      </section>

      {/* 2. ESTOQUE — busca e anúncios reais, logo abaixo da loja */}
      <Section id="destaques" spacing="none" className="border-t border-white/5 py-3 sm:py-6 lg:py-9">
        <div className="flex flex-col">
        <div>
          <p className="hidden font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand sm:block">
            Estoque
          </p>
          <h2 className="font-display text-lg font-semibold leading-tight tracking-tight text-cream sm:mt-0.5 sm:text-2xl">
            Veículos em destaque
          </h2>
          <p className="mt-1 hidden max-w-2xl text-sm leading-snug text-muted sm:block">
            Seleção da loja — no máximo 8 anúncios. O estoque muda rápido.
          </p>
        </div>

        <div className="hero-search mt-3 max-sm:order-3 sm:mt-4">
          <HeroSearch brands={brands} />
        </div>

        <div className="mt-2 max-sm:order-2 sm:mt-4">
          {featured.length === 0 ? (
            <div className="max-w-2xl border border-dashed border-white/15 bg-ink/40 px-5 py-8 text-left">
              <p className="font-display text-lg font-semibold text-cream">
                Estoque sendo montado
              </p>
              <p className="mt-2 max-w-md text-sm leading-snug text-muted">
                Estamos selecionando os próximos veículos. Diga o que você
                procura — buscamos para você.
              </p>
              <SiteLeadHit contentName="Avise-me">
                <WhatsAppButton
                  className="mt-4"
                  trackingLabel="home-wanted"
                  message={WHATSAPP_MESSAGES.wanted()}
                >
                  Quero avisar o que procuro
                </WhatsAppButton>
              </SiteLeadHit>
            </div>
          ) : (
            <VehicleGrid
              vehicles={featured}
              priorityCount={2}
              desktopCols={4}
              destaqueLimit={0}
            />
          )}
        </div>

        <div className="mt-5 max-sm:order-4">
          <Link
            href="/estoque"
            prefetch={false}
            className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
          >
            Ver todos os veículos
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 w-full max-w-2xl max-sm:order-5 sm:hidden">
          <Suspense fallback={<StatsBarSkeleton />}>
            <StatsBar />
          </Suspense>
        </div>

        <div className="mt-5 max-sm:order-6">
          <WantedVehicleCta />
        </div>
        </div>
      </Section>

      <Container><RecentlyViewedVehicles /></Container>

      {/* 3. SELOS DE CONFIANÇA */}
      <Section spacing="snug" className="border-t border-white/5">
        <TrustBadges compact />
      </Section>

      {/* 4. POR QUE ESCOLHER A GARAGEM */}
      <Section spacing="snug" className="border-t border-white/5 bg-ink/40">
        <SectionHeading
          eyebrow="Diferenciais"
          title={`Por que a ${site.name}`}
          description="Três coisas que a gente faz em todo seminovo, antes de você fechar."
        />
        <ul className="mt-5 grid gap-3 lg:grid-cols-3">
          {REASONS.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="flex h-full gap-3 border border-white/10 bg-asphalt p-4 text-left"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center bg-brand/10">
                <Icon className="h-5 w-5 text-brand" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold text-cream">
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-snug text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5. DEPOIMENTOS */}
      <Section spacing="snug" className="border-t border-white/5">
        <SectionHeading
          eyebrow="Depoimentos"
          title="Quem compra, indica"
          description="Depoimentos enviados à loja. Não substituem avaliações do Google."
        />
        {googleReviewsReady(siteContent.google) ? (
          <div className="mt-4">
            <GoogleReviewsBadge reviews={siteContent.google} />
          </div>
        ) : null}
        <div className="mt-4">
          <Testimonials items={testimonials} />
        </div>
      </Section>

      {/* 6. ATENDIMENTO — um número, horário e modalidade reais */}
      <Section spacing="snug" className="border-t border-white/5 bg-ink/40" size="narrow">
        <SectionHeading
          eyebrow="Atendimento"
          title={`Loja digital no ${publicSite.state}`}
          description={`Atendemos ${publicSite.region}. Escolha no site, peça vídeo pelo WhatsApp e combine visita, entrega ou retirada.`}
        />

        <div className="mt-5 overflow-hidden border border-white/10 bg-white/10">
          <dl className="grid gap-px sm:grid-cols-3">
            <div className="bg-asphalt px-4 py-3.5">
              <dt className="font-display text-[11px] font-semibold uppercase tracking-wide text-muted">
                WhatsApp
              </dt>
              <dd className="mt-1 font-display text-base font-semibold text-cream">
                {site.whatsappLabel}
              </dd>
            </div>
            <div className="bg-asphalt px-4 py-3.5">
              <dt className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-muted">
                <IconClock className="h-3.5 w-3.5 text-brand" />
                Horário
              </dt>
              <dd className="mt-1 text-sm leading-snug text-cream">{publicSite.hours}</dd>
            </div>
            <div className="bg-asphalt px-4 py-3.5">
              <dt className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-muted">
                <IconMapPin className="h-3.5 w-3.5 text-brand" />
                Modalidade
              </dt>
              <dd className="mt-1 text-sm leading-snug text-cream">{publicSite.address}</dd>
            </div>
          </dl>
          <a
            href={`https://www.instagram.com/${site.instagram.replace(/^@/, "")}/`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${site.instagram} no Instagram, abre em nova aba`}
            className="group mt-px flex min-h-14 items-center gap-3.5 bg-asphalt px-4 text-cream transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand touch-manipulation"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fd5949_45%,#d6249f_62%,#285AEB_90%)] text-white"
            >
              <IconInstagram className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              {site.instagram}
            </span>
            <IconArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-cream" />
          </a>
        </div>
      </Section>

      {/* 7. VENDER OU TROCAR */}
      <Section spacing="snug" className="border-t border-white/5" size="narrow">
        <div className="relative overflow-hidden border border-white/10 bg-ink">
          <div
            className="absolute inset-x-0 top-0 h-0.5 bg-brand"
            aria-hidden="true"
          />
          <div className="px-5 py-6 sm:px-7 sm:py-7">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              Avaliação sem compromisso
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-cream sm:text-2xl">
              Vender ou trocar seu veículo
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-snug text-muted">
              Compramos seu usado e aceitamos na troca. Manda os dados que a
              gente avalia e faz uma proposta justa.
            </p>
            <ActionRow className="mt-5 sm:justify-start">
              <SiteLeadHit contentName="Vender/Trocar">
                <WhatsAppButton
                  size="lg"
                  trackingLabel="home-vender"
                  message={WHATSAPP_MESSAGES.sell}
                >
                  Avaliar pelo WhatsApp
                </WhatsAppButton>
              </SiteLeadHit>
              <ButtonLink href="/vender" size="lg" variant="outline">
                Preencher formulário
              </ButtonLink>
            </ActionRow>
          </div>
        </div>
      </Section>

      {/* 8. DÚVIDAS */}
      <Section spacing="snug" className="border-t border-white/5 bg-ink/40" size="narrow">
        <SectionHeading
          eyebrow="Dúvidas frequentes"
          title="Antes de fechar negócio"
          description="As perguntas que mais recebemos sobre compra, troca e documentação."
        />
        <div className="mt-4">
          <FaqAccordion items={faqItems.slice(0, 5)} />
          <div className="mt-4">
            <Link
              href="/faq"
              prefetch={false}
              className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
            >
              Ver todas as dúvidas
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      {/* 9. CTA FINAL — mesmo número, chat só em contorno */}
      <Section spacing="snug" className="border-t border-white/5" size="narrow">
        <h2 className="max-w-xl font-display text-xl font-semibold tracking-tight text-cream sm:text-2xl">
          Ainda em dúvida sobre o próximo passo?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-snug text-muted">
          O consultor calcula a parcela no WhatsApp {site.whatsappLabel}. O
          site não publica valor de parcela.
        </p>
        <ActionRow className="mt-4 sm:justify-start">
          <WhatsAppButton
            size="lg"
            className="w-full sm:w-auto"
            trackingLabel="home-final"
            message={WHATSAPP_MESSAGES.visit}
          >
            Falar com um consultor
          </WhatsAppButton>
          <ButtonLink href="/estoque" size="lg" variant="outline" className="w-full sm:w-auto">
            Continuar no estoque
          </ButtonLink>
        </ActionRow>
        <p className="mt-3 max-w-xl text-sm leading-snug text-muted">
          Dúvida breve no site. Preço, visita e proposta seguem no WhatsApp.
        </p>
        <div className="mt-3">
          <ChatOpenButton
            source="home-final"
            variant="outline"
            className="w-full sm:w-auto"
          />
        </div>
      </Section>
    </>
  );
}
