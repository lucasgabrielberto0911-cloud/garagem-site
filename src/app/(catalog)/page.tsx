import Link from "next/link";
import { HomeAssistantButton } from "@/components/site/HomeAssistantCta";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { Testimonials } from "@/components/site/Testimonials";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { RecentlyViewedVehicles } from "@/components/site/RecentlyViewedVehicles";
import { SiteLeadHit } from "@/lib/funnel-events";
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
  IconSwap,
} from "@/components/site/icons";
import { buildPageMetadata, itemListJsonLd, localBusinessJsonLd, websiteJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getGoogleReviews, getPublishedFaq } from "@/lib/site-content";
import { getPublicSite } from "@/lib/site-settings";
import { enrichVehiclesWithLqip } from "@/lib/photo-lqip";
import { HOME_PRIORITY_COUNT } from "@/lib/stock-query";
import { getFeaturedVehicles, getTestimonials } from "@/lib/vehicles";
import { MAX_HOME_FEATURED } from "@/lib/featured";
import { HOME_SEO_DESCRIPTION, HOME_SEO_TITLE } from "@/lib/seo-local";

export const revalidate = 3600;

export const metadata = buildPageMetadata({
  title: HOME_SEO_TITLE,
  description: HOME_SEO_DESCRIPTION,
  path: "/",
});

const HERO_HIGHLIGHTS = [
  { Icon: IconShieldCheck, label: "Garantia de 3 meses motor e câmbio" },
  { Icon: IconClipboardCheck, label: "Vistoria da loja" },
  { Icon: IconSwap, label: "Aceitamos seu carro na troca" },
  { Icon: IconHandshake, label: "Financiamos em até 60x" },
] as const;

const REASONS = [
  {
    Icon: IconClipboardCheck,
    title: "Revisão com garantia",
    text: "A gente revisa cada veículo antes de anunciar. O que encontramos, explicamos pra você no atendimento.",
  },
  {
    Icon: IconShieldCheck,
    title: "Documentação pronta",
    text: "A gente confere o histórico, os débitos e as restrições do veículo. A documentação fica preparada para a transferência, pra você ter mais tranquilidade.",
  },
  {
    Icon: IconHandshake,
    title: "Negociação clara",
    text: "O preço está no anúncio. Há financiamento em até 60 vezes, sujeito à análise de crédito, e pagamento com cartão em até 18 vezes. As condições são combinadas no WhatsApp.",
  },
] as const;

export default async function HomePage() {
  const [featured, publicSite] = await Promise.all([
    getFeaturedVehicles(MAX_HOME_FEATURED),
    getPublicSite(),
  ]);
  const featuredWithLqip = await enrichVehiclesWithLqip(featured);

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
      {/* 1. HERO — título, pontos principais e três botões grandes */}
      <section data-home-page="" className="hero-red-black relative isolate overflow-hidden">
        <div className="hero-color-field" aria-hidden="true">
          <span className="hero-red-orb hero-red-orb-1" />
          <span className="hero-red-orb hero-red-orb-2" />
        </div>
        <div className="hero-bottom-fade" aria-hidden="true" />

        <Container className="py-5 sm:py-7 lg:py-8">
          <h1 className="max-w-3xl font-display text-xl font-semibold leading-snug tracking-tight text-cream sm:text-3xl sm:leading-[1.12]">
            Seminovos com procedência. Atendemos Linhares, Aracruz e Grande Vitória.
          </h1>
          <ul
            data-hero-highlights=""
            className="mt-3 mb-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-base leading-snug text-cream/90 sm:mt-4 sm:mb-0"
          >
            {HERO_HIGHLIGHTS.map(({ Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2">
                <Icon className="h-[18px] w-[18px] shrink-0 text-brand-light" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          {/* Alvo de toque de 56px: acima de 44pt (Apple) e 48dp (Material). */}
          <div className="hero-cta mt-4 grid max-w-xl grid-cols-1 gap-3 sm:mt-5 lg:max-w-4xl lg:grid-cols-3 lg:gap-4">
            <SiteLeadHit contentName="Home Hero">
              <WhatsAppButton
                size="lg"
                className="w-full rounded-xl !min-h-[56px] !px-6 !py-3.5 !text-lg !normal-case !tracking-normal shadow-[0_10px_28px_rgba(37,211,102,0.32)] focus-visible:!ring-4 focus-visible:!ring-white"
                trackingLabel="home-hero"
                message={WHATSAPP_MESSAGES.help}
              >
                Falar no WhatsApp
              </WhatsAppButton>
            </SiteLeadHit>
            <ButtonLink
              href="/estoque"
              size="lg"
              variant="outline"
              className="w-full rounded-xl !min-h-[56px] !px-6 !py-3.5 !text-lg !normal-case !tracking-normal !border-2 !border-white/40 !bg-white/[0.06] hover:!border-white hover:!bg-white/[0.12] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
            >
              Ver estoque
            </ButtonLink>
            <HomeAssistantButton />
          </div>
        </Container>
      </section>

      {/* 2. DESTAQUES — logo depois do topo, só a lista de carros */}
      <Section id="destaques" spacing="none" className="border-t border-white/5 py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col">
        <h2 className="font-display text-xl font-semibold leading-tight tracking-tight text-cream sm:text-2xl">
          Veículos em destaque
        </h2>

        <div className="mt-3 sm:mt-4">
          {featured.length === 0 ? (
            featured.error ? (
              <div
                role="status"
                className="max-w-2xl bg-ink px-5 py-8 text-left"
              >
                <p className="font-display text-lg font-semibold text-cream">
                  Não foi possível carregar os veículos em destaque agora
                </p>
                <p className="mt-2 max-w-md text-sm leading-snug text-muted">
                  Tente atualizar a página em instantes ou confira o estoque e fale direto pelo WhatsApp.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <ButtonLink href="/estoque" variant="outline">
                    Ver estoque
                  </ButtonLink>
                  <SiteLeadHit contentName="Avise-me">
                    <WhatsAppButton
                      trackingLabel="home-wanted"
                      message={WHATSAPP_MESSAGES.wanted()}
                    >
                      Quero avisar o que procuro
                    </WhatsAppButton>
                  </SiteLeadHit>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl bg-ink px-5 py-8 text-left">
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
            )
          ) : (
            <VehicleGrid
              vehicles={featuredWithLqip}
              priorityCount={HOME_PRIORITY_COUNT}
              desktopCols={4}
              destaqueLimit={0}
              pageOrigin="home"
            />
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 max-sm:order-4">
          <Link
            href="/estoque"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-light transition hover:text-brand-orange"
          >
            Ver todos os veículos
            <IconArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/troca"
            prefetch={false}
            className="inline-flex min-h-11 items-center text-sm text-cream/80 underline decoration-white/30 underline-offset-4 transition hover:text-cream hover:decoration-brand"
          >
            Tem carro pra dar na troca?
          </Link>
        </div>

        <div className="mt-5 max-sm:order-5">
          <WantedVehicleCta />
        </div>
        </div>
      </Section>

      <Container><RecentlyViewedVehicles /></Container>

      {/* 3. POR QUE ESCOLHER A GARAGEM */}
      <Section spacing="snug" className="border-t border-white/5 bg-ink/40">
        <SectionHeading
          eyebrow="Diferenciais"
          title={`Por que a ${site.name}`}
          description="Três coisas que fazemos em cada seminovo antes de você fechar a compra."
        />
        <ul className="mt-5 grid gap-3 lg:grid-cols-3">
          {REASONS.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="flex h-full gap-3 bg-white/[0.04] p-4 text-left"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center bg-brand/10">
                <Icon className="h-5 w-5 text-brand-light" />
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
          description="Relatos de clientes enviados à loja."
        />
        <Suspense fallback={
          <div aria-hidden="true" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Aproxima seis cards; quantidade e textos publicados podem variar. */}
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-64 bg-ink max-[360px]:h-72" />
            ))}
          </div>
        }>
          <HomeTestimonials publicSite={publicSite} />
        </Suspense>
        <div className="mt-5">
          <Link
            href="/vendidos"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-light transition hover:text-brand-light/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
          >
            Ver entregas e veículos vendidos
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      {/* 6. ATENDIMENTO — um número, horário e modalidade reais */}
      <Section spacing="snug" className="border-t border-white/5 bg-ink/40">
        <SectionHeading
          eyebrow="Atendimento"
          title="Atendemos Linhares, Aracruz e Grande Vitória"
          description="Escolha no site, peça vídeo pelo WhatsApp e combine visita, entrega ou retirada."
        />

        <div className="mt-5 overflow-hidden bg-white/[0.04]">
          <dl className="grid divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3.5">
              <dt className="font-display text-[11px] font-semibold uppercase tracking-wide text-muted">
                WhatsApp
              </dt>
              <dd className="mt-1 font-display text-base font-semibold text-cream">
                {site.whatsappLabel}
              </dd>
            </div>
            <div className="px-4 py-3.5">
              <dt className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-muted">
                <IconClock className="h-3.5 w-3.5 text-brand-light" />
                Horário
              </dt>
              <dd className="mt-1 text-sm leading-snug text-cream">{publicSite.hours}</dd>
            </div>
            <div className="px-4 py-3.5">
              <dt className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-muted">
                <IconMapPin className="h-3.5 w-3.5 text-brand-light" />
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
            className="group flex min-h-14 items-center gap-3.5 border-t border-white/10 px-4 text-cream transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand touch-manipulation"
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
      <Section spacing="snug" className="border-t border-white/5">
        <div className="relative overflow-hidden bg-ink">
          <div
            className="absolute inset-x-0 top-0 h-0.5 bg-brand"
            aria-hidden="true"
          />
          <div className="px-5 py-6 sm:px-7 sm:py-7">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-light">
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
                  Falar no WhatsApp
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
      <Section spacing="snug" className="border-t border-white/5 bg-ink/40">
        <SectionHeading
          eyebrow="Dúvidas frequentes"
          title="Antes de fechar negócio"
          description="As perguntas que mais recebemos sobre compra, troca e documentação."
        />
        <div className="mt-4">
          <Suspense fallback={
            <div aria-hidden="true" className="mx-auto max-w-3xl divide-y divide-white/10 bg-white/[0.04]">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="h-[84px] max-[360px]:h-24 sm:h-20" />
              ))}
            </div>
          }>
            <HomeFaq />
          </Suspense>
          <div className="mt-4">
            <Link
              href="/faq"
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-light transition hover:text-brand-orange"
            >
              Ver todas as dúvidas
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      {/* 9. CTA FINAL — mesmo número, chat só em contorno */}
      <Section spacing="snug" className="border-t border-white/5">
        <h2 className="max-w-xl font-display text-xl font-semibold tracking-tight text-cream sm:text-2xl">
          Ainda em dúvida sobre o próximo passo?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-snug text-muted">
          Financiamento, troca, vídeo ou visita: fale com o consultor no
          WhatsApp {site.whatsappLabel}.
        </p>
        <ActionRow className="mt-4 sm:justify-start">
          <SiteLeadHit contentName="Home Final">
            <WhatsAppButton
              size="lg"
              className="w-full sm:w-auto"
              trackingLabel="home-final"
              message={WHATSAPP_MESSAGES.visit}
            >
              Falar com um consultor
            </WhatsAppButton>
          </SiteLeadHit>
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

// Dados abaixo da dobra não bloqueiam a busca e as capas do estoque.
async function HomeTestimonials({ publicSite }: { publicSite: Awaited<ReturnType<typeof getPublicSite>> }) {
  const data = await Promise.all([getTestimonials(6), getGoogleReviews()]).catch(error => {
    console.error("[home] falha ao carregar depoimentos:", error);
    return null;
  });
  if (!data) return null;
  const [testimonials, google] = data;
  const reviews = testimonials.filter(item => !String(item.id).startsWith("seed-"));
  return <>
    {reviews.length > 0 ? <JsonLd data={localBusinessJsonLd(publicSite, reviews.map(item => ({
      name: item.name,
      city: item.city,
      message: item.message,
      rating: item.rating,
    })), google)} /> : null}
    <div className="mt-4"><Testimonials items={testimonials} /></div>
  </>;
}

async function HomeFaq() {
  const items = await getPublishedFaq().catch(error => {
    console.error("[home] falha ao carregar dúvidas:", error);
    return null;
  });
  if (!items) return null;
  return <FaqAccordion items={items.slice(0, 5)} />;
}
