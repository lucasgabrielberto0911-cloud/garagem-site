import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { RealStockPreview } from "@/components/site/RealStockPreview";
import {
  IconArrowRight,
  IconClipboardCheck,
  IconClock,
  IconFileText,
  IconHandshake,
  IconMapPin,
  IconPlay,
  IconShieldCheck,
} from "@/components/site/icons";
import {
  ButtonLink,
  Container,
  PageHeader,
  SectionHeading,
  WhatsAppButton,
} from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { SiteLeadHit } from "@/lib/funnel-events";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getFeaturedVehicles } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Como funciona comprar na ${site.name}`,
  description: `Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp: vistoria e procedência, preparação do carro, vídeo detalhado, financiamento, documentação e entrega.`,
  path: "/como-funciona",
});

const HIGHLIGHTS = [
  {
    Icon: IconShieldCheck,
    title: "Vistoria antes do anúncio",
    detail: "Histórico, documentação e estado conferidos antes de ir ao site.",
  },
  {
    Icon: IconPlay,
    title: "Vídeo real no WhatsApp",
    detail: "Você vê detalhes por dentro e por fora antes mesmo da visita.",
  },
  {
    Icon: IconHandshake,
    title: "Entrega combinada",
    detail: "Visita, retirada ou entrega alinhadas direto com o consultor.",
  },
] as const;

const STEPS = [
  {
    Icon: IconShieldCheck,
    title: "Vistoria e procedência",
    text: "Todo veículo passa por vistoria antes de entrar no estoque. Conferimos histórico, documentação e estado de conservação, para você saber de onde o carro vem.",
  },
  {
    Icon: IconClipboardCheck,
    title: "Preparação do carro",
    text: "Revisamos e deixamos o veículo pronto para a entrega: limpeza, itens de segurança e os ajustes necessários.",
  },
  {
    Icon: IconPlay,
    title: "Vídeo detalhado e atendimento no WhatsApp",
    text: "Você escolhe o carro no site e pede o vídeo detalhado no WhatsApp. Se quiser, já alinhamos financiamento em até 60x ou avaliação de troca na mesma conversa.",
  },
  {
    Icon: IconFileText,
    title: "Documentação para transferência",
    text: "Deixamos a documentação preparada para a transferência, com orientação em cada etapa, sem burocracia desnecessária.",
  },
  {
    Icon: IconHandshake,
    title: "Entrega combinada",
    text: "Combinamos com você a forma e a data da entrega. Dúvidas depois da compra? Falamos pelo mesmo WhatsApp.",
  },
] as const;

const WHATSAPP_PERKS = [
  "Vídeo detalhado do veículo que você escolheu",
  "Avaliação do seu usado na troca sem compromisso",
  "Consulta de financiamento em até 60x (sujeito à análise de crédito)",
  "Combinação de visita, retirada ou entrega na região",
] as const;

const NEXT_STEPS = [
  {
    href: "/estoque",
    label: "Ver estoque",
    note: "Seminovos disponíveis com fotos e ficha completa",
  },
  {
    href: "/financiamento",
    label: "Financiamento",
    note: "Até 60x, cartão em até 18x e usado na troca",
  },
  {
    href: "/vendidos",
    label: "Ver entregas realizadas",
    note: "Histórico real de veículos já negociados",
  },
  {
    href: "/guias",
    label: "Guias de compra",
    note: "Dicas práticas para escolher seu próximo carro",
  },
] as const;

export default async function ComoFuncionaPage() {
  const featured = await getFeaturedVehicles(3);

  return (
    <div>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Como funciona", path: "/como-funciona" },
        ])}
      />

      {/* 1. HERO INSTITUCIONAL COM PROFUNDIDADE */}
      <section className="hero-red-black relative isolate overflow-hidden border-b border-white/10 py-10 sm:py-14 lg:py-16">
        <div className="hero-color-field" aria-hidden="true">
          <span className="hero-red-orb hero-red-orb-1" />
          <span className="hero-red-orb hero-red-orb-2" />
        </div>
        <div className="hero-bottom-fade" aria-hidden="true" />

        <Container>
          <PageHeader
            eyebrow="Como funciona"
            title={`Comprar na ${site.name}, passo a passo`}
            description="Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp: você escolhe, confere e fecha com segurança."
          />

          <div className="mx-auto mt-7 flex max-w-xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <SiteLeadHit contentName="Como funciona - Topo">
              <WhatsAppButton
                message={WHATSAPP_MESSAGES.help}
                size="lg"
                trackingLabel="como-funciona-topo"
                className="w-full rounded-xl !min-h-[56px] !text-base !normal-case !tracking-normal sm:w-auto"
              >
                Falar no WhatsApp
              </WhatsAppButton>
            </SiteLeadHit>
            <ButtonLink
              href="/estoque"
              size="lg"
              variant="outline"
              className="w-full rounded-xl !min-h-[56px] !border-white/30 !bg-white/[0.05] !text-base !normal-case !tracking-normal hover:!border-white hover:!bg-white/[0.1] sm:w-auto"
            >
              Ver estoque disponível
            </ButtonLink>
          </div>

          <ul className="mx-auto mt-8 grid max-w-5xl gap-3 sm:grid-cols-3 sm:gap-4">
            {HIGHLIGHTS.map(({ Icon, title, detail }) => (
              <li
                key={title}
                className="flex items-start gap-3.5 rounded-2xl border border-white/15 bg-ink/85 p-4 text-left shadow-[0_14px_32px_-14px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/15 text-brand-light">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-cream sm:text-base">
                    {title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-cream/80">
                    {detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 2. PASSO A PASSO — FUNDO ALTERNADO COM CARDS ELEVADOS */}
      <section className="border-b border-white/10 bg-ink/60 py-12 sm:py-14 lg:py-16">
        <Container>
          <SectionHeading
            eyebrow="Do primeiro contato à chave na mão"
            title="As 5 etapas da sua compra"
            description="Processo direto, transparente e acompanhado do início ao fim pelo mesmo WhatsApp."
          />

          <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:mt-9 lg:grid-cols-6 lg:gap-5">
            {STEPS.map(({ Icon, title, text }, index) => {
              const spanClass =
                index < 3 ? "lg:col-span-2" : "lg:col-span-3";
              return (
                <li
                  key={title}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-asphalt/95 p-5 text-left shadow-[0_16px_38px_-14px_rgba(0,0,0,0.85)] transition hover:border-brand/50 sm:p-6 ${spanClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-white shadow-[0_6px_16px_rgba(217,21,25,0.4)]">
                        {index + 1}
                      </span>
                      <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                        Etapa 0{index + 1}
                      </span>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-ink text-cream/85">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-lg font-bold leading-snug text-cream">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-cream/80 sm:text-[15px]">
                    {text}
                  </p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* 3. FOTOS REAIS DO ESTOQUE */}
      {featured.length > 0 ? (
        <section className="border-b border-white/10 bg-asphalt py-12 sm:py-14 lg:py-16">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Estoque real da loja"
                title="Exemplos prontos para você conferir"
                description="Seminovos próprios revisados e disponíveis agora. Abra a ficha ou peça o vídeo detalhado no WhatsApp."
              />
              <Link
                href="/estoque"
                prefetch={false}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-light transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
              >
                Ver todo o estoque
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 lg:mt-8">
              <RealStockPreview vehicles={featured} variant="cards" />
            </div>
          </Container>
        </section>
      ) : null}

      {/* 4. BLOCO DE ATENDIMENTO + CTA PRINCIPAL */}
      <section className="border-b border-white/10 bg-ink/60 py-12 sm:py-14 lg:py-16">
        <Container>
          <div className="relative overflow-hidden rounded-2xl border border-brand/35 bg-asphalt p-6 shadow-[0_22px_50px_-16px_rgba(0,0,0,0.9)] sm:p-8 lg:p-10">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient"
            />
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
                  Atendimento humano e direto
                </p>
                <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl">
                  Tudo combinado em uma única conversa
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-cream/80 sm:text-base">
                  Sem filas e sem burocracia. Atendemos Linhares, Aracruz e Grande Vitória e combinamos cada detalhe pelo WhatsApp.
                </p>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {WHATSAPP_PERKS.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-ink/80 px-3.5 py-3 text-sm text-cream/90"
                    >
                      <IconShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-ink p-5 shadow-lg sm:p-6 lg:col-span-5">
                <div className="space-y-3 text-sm text-cream/85">
                  <div className="flex items-center gap-2.5">
                    <IconClock className="h-4 w-4 shrink-0 text-brand-light" />
                    <span>{site.hours}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <IconMapPin className="h-4 w-4 shrink-0 text-brand-light" />
                    <span>Linhares, Aracruz e Grande Vitória</span>
                  </div>
                </div>
                <SiteLeadHit contentName="Como funciona">
                  <WhatsAppButton
                    message={WHATSAPP_MESSAGES.help}
                    size="lg"
                    trackingLabel="como-funciona-rodape"
                    className="w-full rounded-xl !min-h-[56px] !text-base !normal-case !tracking-normal"
                  >
                    Falar no WhatsApp
                  </WhatsAppButton>
                </SiteLeadHit>
                <p className="text-center text-xs text-muted">
                  Resposta direta no {site.whatsappLabel}
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 5. PRÓXIMOS PASSOS */}
      <section className="bg-asphalt py-12 sm:py-14">
        <Container size="narrow">
          <nav aria-label="Próximos passos">
            <h2 className="text-center font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
              Próximos passos
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {NEXT_STEPS.map(({ href, label, note }) => (
                <li key={href}>
                  <Link
                    href={href}
                    prefetch={false}
                    className="group flex min-h-[64px] items-center justify-between gap-4 rounded-2xl border border-white/15 bg-ink px-5 py-4 text-left shadow-[0_12px_28px_-12px_rgba(0,0,0,0.8)] transition duration-200 hover:-translate-y-0.5 hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-cream">
                        {label}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-muted">
                        {note}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-asphalt text-brand-light transition group-hover:border-brand/50 group-hover:translate-x-0.5"
                    >
                      <IconArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>
    </div>
  );
}
