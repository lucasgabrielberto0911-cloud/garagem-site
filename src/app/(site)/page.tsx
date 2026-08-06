import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { HeroSearch } from "@/components/site/HeroSearch";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { StatsBar, StatsBarSkeleton } from "@/components/site/StatsBar";
import { Testimonials } from "@/components/site/Testimonials";
import { TrustBadges } from "@/components/site/TrustBadges";
import { VehicleGrid } from "@/components/site/VehicleGrid";
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
import { FAQ_ITEMS } from "@/lib/faq";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";
import {
  getFeaturedVehicles,
  getStockFacets,
  getTestimonials,
} from "@/lib/vehicles";

export const revalidate = 60;

const REASONS = [
  {
    Icon: IconClipboardCheck,
    title: "Vistoria Completa",
    text: "Todo veículo passa por checagem de procedência e condição geral antes de entrar no estoque. Você sabe o que está comprando, com informação clara.",
  },
  {
    Icon: IconShieldCheck,
    title: "Procedência Verificada",
    text: "Histórico, débitos e restrições consultados com cuidado. Nada de surpresa depois da transferência — a documentação sai alinhada.",
  },
  {
    Icon: IconHandshake,
    title: "Negociação Transparente",
    text: "Preço claro, sem enrolação. Avaliamos seu usado e ajudamos com as opções de pagamento e financiamento que façam sentido para você.",
  },
] as const;

export default async function HomePage() {
  const [featured, facets, testimonials, publicSite] = await Promise.all([
    getFeaturedVehicles(8),
    getStockFacets(),
    getTestimonials(6),
    getPublicSite(),
  ]);

  return (
    <>
      {/* 1. HERO */}
      <section className="hero-red-black relative isolate overflow-hidden">
        <div className="hero-color-field" aria-hidden="true">
          <span className="hero-red-orb hero-red-orb-1" />
          <span className="hero-red-orb hero-red-orb-2" />
          <span className="hero-red-orb hero-red-orb-3" />
          <span className="hero-red-glow-line" />
          <span className="hero-grid" />
          <span className="hero-noise" />
        </div>
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-asphalt to-transparent"
          aria-hidden="true"
        />

        <Container className="flex min-h-[auto] flex-col items-center justify-center py-12 text-center sm:min-h-[68dvh] sm:py-16 lg:min-h-[74dvh] lg:py-24">
          <div className="hero-brand">
            <Image
              src="/branding/logo-wordmark.png"
              alt={site.name}
              width={420}
              height={76}
              priority
              className="mx-auto h-auto w-[min(70vw,280px)] sm:w-[min(62vw,400px)] lg:w-[440px]"
            />
          </div>

          <div className="hero-text mt-6 sm:mt-8">
            <h1 className="mx-auto max-w-3xl font-display text-[1.75rem] font-bold leading-[1.15] tracking-tight text-cream sm:text-5xl">
              Encontre seu <span className="brand-shimmer">próximo carro</span>
            </h1>
            <div
              className="mx-auto mt-4 h-1 w-20 bg-brand-gradient sm:mt-5 sm:w-24"
              aria-hidden="true"
            />
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-cream/80 sm:mt-5 sm:text-lg">
              Seminovos revisados e com procedência em {site.region} e região.
              Escolha pelo site, feche pelo WhatsApp e saia dirigindo.
            </p>
          </div>

          <div className="hero-search mt-7 flex w-full justify-center sm:mt-9">
            <HeroSearch brands={facets.brands} />
          </div>

          <ActionRow className="hero-cta mt-6 w-full sm:mt-8 sm:w-auto">
            <ButtonLink href="/estoque" size="lg">
              Ver estoque completo
            </ButtonLink>
            <WhatsAppButton size="lg" variant="outline" className="hidden sm:inline-flex">
              Falar com um consultor
            </WhatsAppButton>
          </ActionRow>

          <div className="hero-stats mt-8 w-full max-w-2xl sm:mt-12">
            <Suspense fallback={<StatsBarSkeleton />}>
              <StatsBar />
            </Suspense>
          </div>
        </Container>
      </section>

      {/* 2. SELOS DE CONFIANÇA */}
      <Section spacing="tight">
        <ScrollReveal>
          <TrustBadges />
        </ScrollReveal>
      </Section>

      {/* 3. VEÍCULOS EM DESTAQUE */}
      <Section id="destaques" className="border-t border-white/5">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Estoque"
            title="Veículos em destaque"
            description="Uma seleção do que temos disponível agora. O estoque gira rápido — se gostar de algum, chame no WhatsApp para garantir."
          />
        </ScrollReveal>

        <div className="mt-8">
          {featured.length === 0 ? (
            <ScrollReveal>
              <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-10 text-center">
                <p className="font-display text-lg font-semibold text-cream">
                  Estoque sendo montado
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                  Estamos selecionando os próximos veículos. Fale com a gente e
                  diga o que você procura — buscamos para você.
                </p>
                <WhatsAppButton
                  className="mt-5"
                  message={WHATSAPP_MESSAGES.general}
                >
                  Quero avisar o que procuro
                </WhatsAppButton>
              </div>
            </ScrollReveal>
          ) : (
            <VehicleGrid vehicles={featured} reveal priorityCount={2} />
          )}
        </div>

        <div className="mt-7 text-center">
          <Link
            href="/estoque"
            className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
          >
            Ver todos os veículos
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ScrollReveal className="mt-10">
          <WantedVehicleCta />
        </ScrollReveal>
      </Section>

      {/* 4. POR QUE ESCOLHER A GARAGEM */}
      <Section className="border-t border-white/5 bg-ink/40">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Diferenciais"
            title={`Por que escolher a ${site.name}`}
            description="Comprar seminovo não precisa ser aposta. Estes são os três compromissos que assumimos com todo cliente."
          />
        </ScrollReveal>
        <ul className="mx-auto mt-12 grid gap-5 lg:grid-cols-3">
          {REASONS.map(({ Icon, title, text }, index) => (
            <ScrollReveal key={title} delay={index * 50}>
              <li className="card-lift flex h-full flex-col items-center border border-white/10 bg-asphalt p-7 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center bg-brand/10">
                  <Icon className="h-6 w-6 text-brand" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            </ScrollReveal>
          ))}
        </ul>
      </Section>

      {/* 5. DEPOIMENTOS */}
      <Section className="border-t border-white/5">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Depoimentos"
            title="Quem compra, indica"
            description="Avaliações de clientes que fecharam negócio com a gente."
          />
        </ScrollReveal>
        <div className="mt-12">
          <ScrollReveal delay={40}>
            <Testimonials items={testimonials} />
          </ScrollReveal>
        </div>
      </Section>

      {/* 6. ATENDIMENTO */}
      <Section className="border-t border-white/5 bg-ink/40" size="narrow">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Atendimento"
            title={`Atendemos ${publicSite.region} e região`}
            description={`Somos loja digital em ${publicSite.region}, no ${publicSite.state}. Escolha no site, peça vídeo pelo WhatsApp e feche com segurança — atendimento online todos os dias, das 8h às 23h.`}
          />
        </ScrollReveal>

        <ScrollReveal delay={40}>
          <dl className="mx-auto mt-10 grid max-w-3xl gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
            <div className="flex flex-col items-center bg-asphalt px-6 py-7 text-center">
              <IconMapPin className="h-6 w-6 text-brand" />
              <dt className="mt-3 font-display text-sm font-semibold text-cream">
                Modalidade
              </dt>
              <dd className="mt-1 text-sm text-muted">{publicSite.address}</dd>
            </div>
            <div className="flex flex-col items-center bg-asphalt px-6 py-7 text-center">
              <IconClock className="h-6 w-6 text-brand" />
              <dt className="mt-3 font-display text-sm font-semibold text-cream">
                Horário online
              </dt>
              <dd className="mt-1 text-sm text-muted">{publicSite.hours}</dd>
            </div>
          </dl>
        </ScrollReveal>

        <ScrollReveal delay={60}>
          <div className="relative mx-auto mt-8 aspect-[16/9] max-w-3xl overflow-hidden border border-white/10">
            <Image
              src="/branding/hero-bg.jpg"
              alt={`Loja ${site.name}`}
              fill
              sizes="(min-width: 1024px) 768px, 100vw"
              quality={70}
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-asphalt/80 to-transparent"
              aria-hidden="true"
            />
          </div>
        </ScrollReveal>

        <ActionRow className="mt-8">
          <WhatsAppButton size="lg" message={WHATSAPP_MESSAGES.visit}>
            Chamar no WhatsApp
          </WhatsAppButton>
          <ButtonLink href="/contato" size="lg" variant="outline">
            Ver contato completo
          </ButtonLink>
          <a
            href={site.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center justify-center gap-2.5 border border-white/20 px-7 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-white/5 sm:text-base"
          >
            <IconInstagram className="h-5 w-5" />
            {site.instagram}
          </a>
        </ActionRow>
      </Section>

      {/* 7. VENDER OU TROCAR */}
      <Section className="border-t border-white/5" size="narrow">
        <ScrollReveal>
          <div className="relative overflow-hidden border border-white/10 bg-ink text-center">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-brand-gradient"
              aria-hidden="true"
            />
            <div className="px-6 py-12 sm:px-10">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                Avaliação sem compromisso
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl">
                Vender ou trocar seu carro
              </h2>
              <div
                className="mx-auto mt-4 h-0.5 w-16 bg-brand-gradient"
                aria-hidden="true"
              />
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Compramos seu usado e aceitamos na troca. Manda os dados do
                veículo que a gente avalia rápido e faz uma proposta justa, sem
                enrolação.
              </p>
              <ActionRow className="mt-8">
                <WhatsAppButton size="lg" message={WHATSAPP_MESSAGES.sell}>
                  Avaliar pelo WhatsApp
                </WhatsAppButton>
                <ButtonLink href="/vender" size="lg" variant="outline">
                  Preencher formulário
                </ButtonLink>
              </ActionRow>
            </div>
          </div>
        </ScrollReveal>
      </Section>

      {/* 8. DÚVIDAS FREQUENTES */}
      <Section className="border-t border-white/5 bg-ink/40" size="narrow">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Dúvidas frequentes"
            title="Antes de fechar negócio"
            description="As perguntas que mais recebemos sobre compra, troca, financiamento e documentação."
          />
        </ScrollReveal>
        <div className="mt-12">
          <FaqAccordion items={FAQ_ITEMS.slice(0, 4)} />
          <div className="mt-6 text-center">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
            >
              Ver todas as dúvidas
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      {/* 9. CTA FINAL */}
      <Section className="border-t border-white/5 bg-ink/40 text-center" size="narrow">
        <ScrollReveal>
          <h2 className="mx-auto max-w-2xl font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl lg:text-4xl">
            Pronto para encontrar seu próximo carro?
          </h2>
          <div
            className="mx-auto mt-5 h-0.5 w-16 bg-brand-gradient"
            aria-hidden="true"
          />
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            Veja o estoque completo ou fale agora com um consultor da {site.name}.
          </p>
          <ActionRow className="mt-9">
            <ButtonLink href="/estoque" size="lg">
              Ver estoque completo
            </ButtonLink>
            <WhatsAppButton size="lg" variant="outline">
              WhatsApp
            </WhatsAppButton>
          </ActionRow>
        </ScrollReveal>
      </Section>
    </>
  );
}
