import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { HeroSearch } from "@/components/site/HeroSearch";
import { StatsBar, StatsBarSkeleton } from "@/components/site/StatsBar";
import { Testimonials } from "@/components/site/Testimonials";
import { TrustBadges } from "@/components/site/TrustBadges";
import { VehicleCard } from "@/components/site/VehicleCard";
import {
  ButtonLink,
  Section,
  SectionHeading,
  WhatsAppButton,
} from "@/components/site/ui";
import {
  IconArrowRight,
  IconClipboardCheck,
  IconClock,
  IconHandshake,
  IconMapPin,
  IconShieldCheck,
} from "@/components/site/icons";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getFeaturedVehicles, getStockFacets, getTestimonials } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

const REASONS = [
  {
    Icon: IconClipboardCheck,
    title: "Vistoria Completa",
    text: "Todo veículo passa por checagem mecânica, elétrica e estrutural antes de entrar no estoque. Você recebe o laudo e sabe exatamente o que está comprando.",
  },
  {
    Icon: IconShieldCheck,
    title: "Procedência Verificada",
    text: "Histórico, débitos e restrições consultados um por um. Nada de surpresa depois da transferência — a documentação sai limpa.",
  },
  {
    Icon: IconHandshake,
    title: "Negociação Transparente",
    text: "Preço claro, sem taxa escondida. Avaliamos seu usado na hora e montamos o financiamento que caiba no seu bolso.",
  },
] as const;

export default async function HomePage() {
  const [featured, facets, testimonials] = await Promise.all([
    getFeaturedVehicles(8),
    getStockFacets(),
    getTestimonials(6),
  ]);

  return (
    <>
      {/* 1. HERO */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/branding/hero-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-asphalt via-asphalt/90 to-asphalt/40"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-asphalt to-transparent"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            {site.name} · Seminovos
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-[1.1] tracking-tight text-cream sm:text-5xl lg:text-6xl">
            Encontre seu próximo carro
          </h1>
          <div className="mt-6 h-1 w-24 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-cream/80 sm:text-lg">
            Seminovos revisados e com procedência, para quem é do{" "}
            {site.state}. Escolha pelo site, feche pelo WhatsApp e saia dirigindo.
          </p>

          <div className="mt-9">
            <HeroSearch brands={facets.brands} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/estoque" size="lg">
              Ver estoque completo
            </ButtonLink>
            <WhatsAppButton size="lg" variant="outline">
              Falar com um consultor
            </WhatsAppButton>
          </div>

          <div className="mt-12 max-w-2xl">
            <Suspense fallback={<StatsBarSkeleton />}>
              <StatsBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* 2. SELOS DE CONFIANÇA */}
      <Section className="py-8 lg:py-10">
        <TrustBadges />
      </Section>

      {/* 3. VEÍCULOS EM DESTAQUE */}
      <Section id="destaques" className="border-t border-white/5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            align="left"
            eyebrow="Estoque"
            title="Veículos em destaque"
            description="Uma seleção do que temos disponível agora. O estoque gira rápido — se gostar de algum, chame no WhatsApp para garantir."
          />
          <Link
            href="/estoque"
            className="inline-flex shrink-0 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
          >
            Ver todos
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="mt-10 border border-dashed border-white/15 bg-ink/40 px-6 py-14 text-center">
            <p className="font-display text-lg font-semibold text-cream">
              Estoque sendo montado
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              Estamos selecionando os próximos veículos. Fale com a gente e diga
              o que você procura — buscamos para você.
            </p>
            <WhatsAppButton className="mt-6" message={WHATSAPP_MESSAGES.general}>
              Quero avisar o que procuro
            </WhatsAppButton>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </Section>

      {/* 4. POR QUE ESCOLHER A GARAGEM */}
      <Section className="border-t border-white/5 bg-ink/40">
        <SectionHeading
          eyebrow="Diferenciais"
          title={`Por que escolher a ${site.name}`}
          description="Comprar seminovo não precisa ser aposta. Estes são os três compromissos que assumimos com todo cliente."
        />
        <ul className="mt-12 grid gap-5 lg:grid-cols-3">
          {REASONS.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="border border-white/10 bg-asphalt p-7 transition hover:border-brand/40"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center bg-brand/10">
                <Icon className="h-6 w-6 text-brand" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-cream">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5. DEPOIMENTOS */}
      <Section className="border-t border-white/5">
        <SectionHeading
          eyebrow="Depoimentos"
          title="Quem compra, indica"
          description="Avaliações de clientes que fecharam negócio com a gente."
        />
        <div className="mt-12">
          <Testimonials items={testimonials} />
        </div>
      </Section>

      {/* 6. LOCALIZAÇÃO */}
      <Section className="border-t border-white/5 bg-ink/40">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Onde estamos"
              title={`Atendemos ${site.region} e região`}
              description={`Somos de ${site.region}, no ${site.state}, e atendemos toda a região. Agende sua visita para ver o carro de perto e fazer o test-drive — ou resolva tudo à distância pelo WhatsApp, que a gente envia vídeo e laudo do veículo.`}
            />
            <dl className="mt-8 space-y-4">
              <div className="flex gap-3">
                <IconMapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                  <dt className="font-display text-sm font-semibold text-cream">
                    Endereço
                  </dt>
                  <dd className="text-sm text-muted">{site.address}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <IconClock className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                  <dt className="font-display text-sm font-semibold text-cream">
                    Horário de funcionamento
                  </dt>
                  <dd className="text-sm text-muted">{site.hours}</dd>
                </div>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <WhatsAppButton size="lg" message={WHATSAPP_MESSAGES.visit}>
                Chamar no WhatsApp
              </WhatsAppButton>
              <ButtonLink href="/contato" size="lg" variant="outline">
                Ver contato completo
              </ButtonLink>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden border border-white/10">
            <Image
              src="/branding/hero-bg.jpg"
              alt={`Loja ${site.name}`}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-asphalt/80 to-transparent"
              aria-hidden="true"
            />
          </div>
        </div>
      </Section>

      {/* 7. VENDER OU TROCAR */}
      <Section className="border-t border-white/5">
        <div className="relative overflow-hidden border border-white/10 bg-ink">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-brand-gradient"
            aria-hidden="true"
          />
          <div className="grid items-center gap-8 p-8 lg:grid-cols-[1.4fr_1fr] lg:p-12">
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                Avaliação sem compromisso
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl lg:text-4xl">
                Vender ou trocar seu carro
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Compramos seu usado e aceitamos na troca. Manda os dados do
                veículo que a gente avalia rápido e faz uma proposta justa, sem
                enrolação.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <WhatsAppButton size="lg" message={WHATSAPP_MESSAGES.sell}>
                Avaliar pelo WhatsApp
              </WhatsAppButton>
              <ButtonLink href="/vender" size="lg" variant="outline">
                Preencher formulário
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      {/* 8. CTA FINAL */}
      <Section className="border-t border-white/5 bg-ink/40 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl lg:text-4xl">
          Pronto para encontrar seu próximo carro?
        </h2>
        <div className="mx-auto mt-5 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Veja o estoque completo ou fale agora com um consultor da {site.name}.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/estoque" size="lg">
            Ver estoque completo
          </ButtonLink>
          <WhatsAppButton size="lg" variant="outline">
            WhatsApp
          </WhatsAppButton>
        </div>
      </Section>
    </>
  );
}
