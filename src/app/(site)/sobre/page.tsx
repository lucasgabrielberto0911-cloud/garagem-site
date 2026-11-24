import type { Metadata } from "next";
import Link from "next/link";
import { FounderSection } from "@/components/site/FounderSection";
import { TrustBadges } from "@/components/site/TrustBadges";
import {
  ActionRow,
  ButtonLink,
  Container,
  PageHeader,
  WhatsAppButton,
} from "@/components/site/ui";
import {
  IconClipboardCheck,
  IconHandshake,
  IconShieldCheck,
  IconWhatsApp,
} from "@/components/site/icons";
import { JsonLd } from "@/components/JsonLd";
import { SiteLeadHit } from "@/lib/funnel-events";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { getSiteContent } from "@/lib/site-content";
import {
  formatSobreHeaderDescription,
  formatSobreHistoryParagraph,
  formatSoldStatLabel,
  getPublicSite,
} from "@/lib/site-settings";
import { getSiteStats } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Sobre a ${site.name}`,
  description: `Conheça a ${site.name}: mais de 20 anos de história e seminovos com procedência. Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp.`,
  path: "/sobre",
});

const DIFERENCIAIS = [
  {
    Icon: IconClipboardCheck,
    title: "Qualidade antes do anúncio",
    text: "A gente revisa cada veículo — quilometragem e condição geral — antes de anunciar. Se algo importa pra sua decisão, a gente fala com clareza, sem surpresa na hora de fechar.",
  },
  {
    Icon: IconShieldCheck,
    title: "Negociação transparente",
    text: "Preço, documentação, troca e financiamento são explicados sem enrolação. Nosso compromisso é você entender o que está comprando e sair seguro da decisão.",
  },
  {
    Icon: IconHandshake,
    title: "Atendimento de perto, mesmo online",
    text: "Combinamos o atendimento pelo WhatsApp, com contato humano de ponta a ponta: resposta rápida, vídeo do veículo, avaliação de troca e acompanhamento até a transferência. Qualidade no atendimento é o nosso padrão.",
  },
  {
    Icon: IconWhatsApp,
    title: "Disponíveis quando você precisa",
    text: "Atendemos todos os dias, das 8h às 23h. Escolha pelo site, tire dúvidas pelo WhatsApp e avance no seu ritmo — com praticidade e sem abrir mão do cuidado.",
  },
] as const;

const TOC = [
  { id: "historia", label: "Nossa história" },
  { id: "missao", label: "Missão e valores" },
  { id: "compromisso", label: "Compromisso" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "dados", label: "Dados da empresa" },
] as const;

export default async function SobrePage() {
  const [publicSite, stats, siteContent] = await Promise.all([
    getPublicSite(),
    getSiteStats(),
    getSiteContent(),
  ]);
  const soldLabel = formatSoldStatLabel(stats.sales);
  const highlightStats = [
    { value: publicSite.aboutYears, label: "anos de história", href: undefined },
    { value: soldLabel, label: "veículos vendidos", href: "/vendidos" },
    { value: publicSite.aboutHours, label: "atendimento online", href: undefined },
    { value: publicSite.aboutFocus, label: "foco no cliente", href: undefined },
  ];

  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Sobre", path: "/sobre" },
        ])}
      />
      <Container>
        <PageHeader
          eyebrow="Sobre nós"
          title={publicSite.name}
          description={formatSobreHeaderDescription(stats.sales)}
        />

        <div className="mt-6 flex justify-center">
          <SiteLeadHit contentName="Sobre">
            <WhatsAppButton size="lg" className="w-full sm:w-auto" trackingLabel="sobre-topo">
              Falar no WhatsApp
            </WhatsAppButton>
          </SiteLeadHit>
        </div>

        <p className="mx-auto mt-6 max-w-3xl bg-white/[0.04] px-5 py-3.5 text-center text-sm leading-relaxed text-cream/80">
          <span className="font-semibold text-cream">Elias Netto</span>, dono e sócio-administrador
          {" · "}
          {publicSite.legalName}
          {" · "}
          CNPJ <span className="whitespace-nowrap text-cream">{publicSite.cnpj}</span>
        </p>

        <FounderSection photoUrl={siteContent.founderPhotoUrl} />

        <div className="mx-auto mt-8 max-w-5xl bg-white/[0.04] px-6 py-7 text-center sm:mt-10 sm:px-10 sm:py-8">
          <div
            className="mx-auto mb-4 h-0.5 w-14 bg-brand-gradient"
            aria-hidden="true"
          />
          <p className="font-display text-lg font-semibold tracking-tight text-cream sm:text-xl">
            Procedência. Clareza. Resultado.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-cream/80">
            Compra, venda, troca e financiamento com o rigor de quem trata
            cada negócio com seriedade — do primeiro contato à entrega.
          </p>
        </div>

        <ul className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-px bg-white/[0.08] sm:mt-10 sm:grid-cols-4">
          {highlightStats.map((stat) => (
            <li
              key={stat.label}
              className="flex flex-col items-center bg-ink px-4 py-6 text-center"
            >
              <p className="font-display text-2xl font-bold text-brand-light sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wider text-cream/75">
                {stat.label}
              </p>
              {stat.href ? (
                <Link
                  href={stat.href}
                  prefetch={false}
                  className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-brand-light underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                >
                  Ver entregas →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-14 max-w-5xl lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-12">
          <nav
            aria-label="Índice da página"
            className="mb-8 flex justify-center gap-2 overflow-x-auto pb-1 scrollbar-hide lg:sticky lg:top-24 lg:mb-0 lg:flex-col lg:justify-start lg:gap-1 lg:overflow-visible lg:pb-0"
          >
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="inline-flex min-h-11 shrink-0 items-center bg-white/[0.04] px-3.5 font-display text-xs font-semibold uppercase tracking-wider text-cream/80 transition hover:bg-white/[0.09] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:w-full lg:bg-transparent lg:px-3 lg:hover:bg-white/[0.05]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="min-w-0">
            <div className="grid gap-10 lg:grid-cols-2">
              <article id="historia" className="scroll-mt-28 text-center lg:text-left">
                <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                  Nossa história
                </h2>
                <div
                  className="mx-auto mt-4 h-0.5 w-12 bg-brand-gradient lg:mx-0"
                  aria-hidden="true"
                />
                <div className="mt-5 space-y-4 text-sm leading-relaxed text-cream/80">
                  <p>
                    A {publicSite.name} nasceu da paixão por veículos e da vontade de
                    fazer diferente: vender seminovo com informação clara, respeito
                    ao cliente e zero enrolação. Ao longo de mais de duas décadas,
                    construímos uma trajetória marcada pela confiança de famílias em
                    Linhares, Aracruz, Grande Vitória e em todo o {publicSite.state}.
                  </p>
                  <p>{formatSobreHistoryParagraph(stats.sales)}</p>
                  <p>
                    Hoje{" "}
                    <strong className="text-cream">
                      atendemos Linhares, Aracruz e Grande Vitória
                    </strong>{" "}
                    e combinamos o atendimento pelo WhatsApp, todos os dias, das
                    8h às 23h. A vitrine está no site, a conversa no WhatsApp e o
                    compromisso continua o mesmo: qualidade em cada veículo e
                    excelência no atendimento.
                  </p>
                </div>
              </article>

              <article id="missao" className="scroll-mt-28 text-center lg:text-left">
                <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                  Missão e valores
                </h2>
                <div
                  className="mx-auto mt-4 h-0.5 w-12 bg-brand-gradient lg:mx-0"
                  aria-hidden="true"
                />
                <div className="mt-5 space-y-4 text-sm leading-relaxed text-cream/80">
                  <p>
                    <strong className="font-display font-semibold text-cream">
                      Missão.
                    </strong>{" "}
                    Facilitar a compra e a venda de seminovos com transparência,
                    segurança e o melhor atendimento — do primeiro contato no
                    WhatsApp até a transferência do veículo.
                  </p>
                  <p>
                    <strong className="font-display font-semibold text-cream">
                      Visão.
                    </strong>{" "}
                    Ser referência de confiança em seminovos — atendemos Linhares,
                    Aracruz e Grande Vitória para que cada cliente negocie com
                    clareza e saia satisfeito.
                  </p>
                  <p>
                    <strong className="font-display font-semibold text-cream">
                      Valores.
                    </strong>{" "}
                    Honestidade na negociação, cuidado com cada veículo, respeito ao
                    tempo do cliente, disponibilidade real no atendimento e
                    compromisso com a qualidade do início ao fim.
                  </p>
                </div>
              </article>
            </div>

            <section id="compromisso" className="mt-14 scroll-mt-28">
              <h2 className="text-center font-display text-xl font-bold tracking-tight text-cream sm:text-2xl lg:text-left">
                Nosso compromisso com você
              </h2>
              <div
                className="mx-auto mt-4 h-0.5 w-12 bg-brand-gradient lg:mx-0"
                aria-hidden="true"
              />
              <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-cream/80 lg:mx-0 lg:text-left">
                Qualidade e atendimento não são slogan: são o jeito como fechamos
                cada negócio. Você merece clareza, agilidade e um time que resolve.
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {DIFERENCIAIS.map(({ Icon, title, text }) => (
                  <li
                    key={title}
                    className="flex flex-col items-center bg-ink p-6 text-center lg:items-start lg:text-left"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center bg-brand/10">
                      <Icon className="h-5 w-5 text-brand-light" />
                    </span>
                    <h3 className="mt-4 font-display text-base font-semibold text-cream">
                      {title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-cream/80">{text}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="como-funciona"
              className="mt-14 scroll-mt-28 overflow-hidden bg-ink text-center lg:text-left"
            >
              <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
              <div className="p-7 sm:p-10">
                <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                  Como funciona o atendimento da Garagem
                </h2>
                <ol className="mx-auto mt-7 grid max-w-3xl gap-6 text-left sm:grid-cols-3 lg:mx-0">
                  {[
                    {
                      step: "01",
                      title: "Escolha no site",
                      text: "Navegue no estoque, veja fotos e detalhes e salve seus favoritos.",
                    },
                    {
                      step: "02",
                      title: "Fale no WhatsApp",
                      text: "Peça vídeo, tire dúvidas, avalie troca ou financiamento — respondemos das 8h às 23h.",
                    },
                    {
                      step: "03",
                      title: "Feche com segurança",
                      text: "Combinamos visita ou entrega, documentação e pagamento com acompanhamento completo.",
                    },
                  ].map((item) => (
                    <li key={item.step} className="text-center sm:text-left">
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-light">
                        {item.step}
                      </p>
                      <h3 className="mt-2 font-display text-base font-semibold text-cream">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-cream/80">
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <div className="mt-10">
              <TrustBadges />
            </div>

            <div
              id="dados"
              className="mt-10 scroll-mt-28 bg-white/[0.04] p-6 text-center sm:p-7 lg:text-left"
            >
              <h2 className="font-display text-base font-semibold text-cream">
                Dados da empresa
              </h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-cream/75">
                    Razão social
                  </dt>
                  <dd className="mt-1 text-sm text-cream">{publicSite.legalName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-cream/75">
                    CNPJ
                  </dt>
                  <dd className="mt-1 text-sm text-cream">{publicSite.cnpj}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-cream/75">
                    Atendimento
                  </dt>
                  <dd className="mt-1 text-sm text-cream">{publicSite.address}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-cream/75">
                    Instagram
                  </dt>
                  <dd className="mt-1 text-sm">
                    <a
                      href={publicSite.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-brand-light underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {publicSite.instagram}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <ActionRow className="mt-12">
              <ButtonLink href="/estoque" size="lg">
                Ver estoque completo
              </ButtonLink>
              <SiteLeadHit contentName="Sobre">
                <WhatsAppButton size="lg" variant="outline" trackingLabel="sobre">
                  Falar com a {publicSite.name}
                </WhatsAppButton>
              </SiteLeadHit>
            </ActionRow>
          </div>
        </div>
      </Container>
    </div>
  );
}
