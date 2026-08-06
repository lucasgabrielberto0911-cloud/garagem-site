import type { Metadata } from "next";
import Image from "next/image";
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
import { site } from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Sobre a ${site.name}`,
  description: `Conheça a ${site.name}: mais de 20 anos de história, mais de 1.000 carros vendidos e atendimento digital com qualidade em ${site.region} e região.`,
  alternates: { canonical: "/sobre" },
};

const DIFERENCIAIS = [
  {
    Icon: IconClipboardCheck,
    title: "Qualidade antes do anúncio",
    text: "Cada veículo passa por checagem de procedência, quilometragem e condição geral antes de entrar no estoque. Se algo importa para a decisão, a gente informa com clareza — sem surpresa na hora de fechar.",
  },
  {
    Icon: IconShieldCheck,
    title: "Negociação transparente",
    text: "Preço, documentação, troca e financiamento são explicados sem enrolação. Nosso compromisso é você entender o que está comprando e sair seguro da decisão.",
  },
  {
    Icon: IconHandshake,
    title: "Atendimento de perto, mesmo online",
    text: "Somos loja digital, mas o contato é humano: WhatsApp rápido, vídeo do carro, avaliação de troca e acompanhamento até a transferência. Qualidade no atendimento é o nosso padrão.",
  },
  {
    Icon: IconWhatsApp,
    title: "Disponíveis quando você precisa",
    text: "Atendemos todos os dias, das 8h às 23h. Escolha pelo site, tire dúvidas pelo WhatsApp e avance no seu ritmo — com a praticidade de quem vive o digital sem abrir mão do cuidado.",
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
  const publicSite = await getPublicSite();
  const stats = [
    { value: publicSite.aboutYears, label: "anos de história" },
    { value: publicSite.aboutSold, label: "carros vendidos" },
    { value: publicSite.aboutHours, label: "atendimento online" },
    { value: publicSite.aboutFocus, label: "foco no cliente" },
  ];

  return (
    <div className="py-12 lg:py-16">
      <Container>
        <PageHeader
          eyebrow="Sobre nós"
          title={publicSite.name}
          description={`Mais de 20 anos de mercado. Mais de 1.000 veículos negociados. Seminovos com procedência, negociação clara e atendimento de excelência em ${publicSite.region} e região.`}
        />

        <div className="relative mt-10 aspect-[4/3] overflow-hidden border border-white/10 sm:mt-12 sm:aspect-[16/9] lg:max-w-4xl">
          <Image
            src="/branding/hero-bg.jpg"
            alt={`Estoque e atendimento da ${publicSite.name}`}
            fill
            sizes="(min-width: 1024px) 896px, 100vw"
            quality={70}
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-asphalt via-asphalt/40 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 p-4 text-center sm:p-8">
            <p className="font-display text-base font-semibold text-cream sm:text-xl">
              Procedência. Clareza. Resultado.
            </p>
            <p className="mx-auto mt-1.5 max-w-lg text-xs text-cream/75 sm:mt-2 sm:text-sm">
              Compra, venda, troca e financiamento com o rigor de quem trata
              cada negócio com seriedade — do primeiro contato à entrega.
            </p>
          </div>
        </div>

        <ul className="mt-10 grid max-w-4xl grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-4">
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="flex flex-col items-center bg-ink px-4 py-6 text-center"
            >
              <p className="font-display text-2xl font-bold text-brand sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">
                {stat.label}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-14 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            aria-label="Índice da página"
            className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:sticky lg:top-24 lg:mb-0 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="inline-flex min-h-[40px] shrink-0 items-center border border-white/10 px-3 font-display text-xs font-semibold uppercase tracking-wider text-muted transition hover:border-brand hover:text-cream lg:w-full"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="min-w-0 max-w-3xl">
            <div className="grid gap-10 lg:grid-cols-2">
              <article id="historia" className="scroll-mt-28 text-center lg:text-left">
                <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                  Nossa história
                </h2>
                <div
                  className="mx-auto mt-4 h-0.5 w-12 bg-brand-gradient lg:mx-0"
                  aria-hidden="true"
                />
                <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
                  <p>
                    A {publicSite.name} nasceu da paixão por carros e da vontade de
                    fazer diferente: vender seminovo com informação clara, respeito
                    ao cliente e zero enrolação. Ao longo de mais de duas décadas,
                    construímos uma trajetória marcada pela confiança de famílias em{" "}
                    {publicSite.region} e em todo o {publicSite.state}.
                  </p>
                  <p>
                    Foram mais de 1.000 veículos entregues — cada um com atenção à
                    procedência, à documentação e ao que o cliente realmente
                    precisava. Crescemos ouvindo quem compra, quem vende e quem
                    volta para indicar um amigo.
                  </p>
                  <p>
                    Hoje operamos como{" "}
                    <strong className="text-cream">loja digital</strong>, com
                    atendimento online todos os dias, das 8h às 23h. A vitrine
                    está no site, a conversa no WhatsApp e o compromisso continua o
                    mesmo: qualidade no carro e excelência no atendimento.
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
                <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
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
                    Ser a referência em seminovos digitais de {publicSite.region}{" "}
                    e região: a loja em que o cliente confia para negociar com
                    clareza e sair satisfeito.
                  </p>
                  <p>
                    <strong className="font-display font-semibold text-cream">
                      Valores.
                    </strong>{" "}
                    Honestidade na negociação, cuidado com cada carro, respeito ao
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
              <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-muted lg:mx-0 lg:text-left">
                Qualidade e atendimento não são slogan: são o jeito como fechamos
                cada negócio. Você merece clareza, agilidade e um time que resolve.
              </p>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2">
                {DIFERENCIAIS.map(({ Icon, title, text }) => (
                  <li
                    key={title}
                    className="flex flex-col items-center border border-white/10 bg-ink p-6 text-center lg:items-start lg:text-left"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center bg-brand/10">
                      <Icon className="h-5 w-5 text-brand" />
                    </span>
                    <h3 className="mt-5 font-display text-base font-semibold text-cream">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="como-funciona"
              className="mt-14 scroll-mt-28 border border-brand/30 bg-ink p-8 text-center sm:p-10 lg:text-left"
            >
              <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                Como funciona a Garagem digital
              </h2>
              <div
                className="mx-auto mt-4 h-0.5 w-12 bg-brand-gradient lg:mx-0"
                aria-hidden="true"
              />
              <ol className="mx-auto mt-8 grid max-w-3xl gap-6 text-left sm:grid-cols-3 lg:mx-0">
                {[
                  {
                    step: "01",
                    title: "Escolha no site",
                    text: "Navegue no estoque, filtre por marca, ano e valor e salve seus favoritos.",
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
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                      {item.step}
                    </p>
                    <h3 className="mt-2 font-display text-base font-semibold text-cream">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.text}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <div className="mt-12">
              <TrustBadges />
            </div>

            <div
              id="dados"
              className="mt-12 scroll-mt-28 border border-white/10 bg-ink p-6 text-center lg:text-left"
            >
              <h2 className="font-display text-base font-semibold text-cream">
                Dados da empresa
              </h2>
              <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">
                    Razão social
                  </dt>
                  <dd className="mt-1 text-sm text-cream">{publicSite.legalName}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">
                    CNPJ
                  </dt>
                  <dd className="mt-1 text-sm text-cream">{publicSite.cnpj}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">
                    Atendimento
                  </dt>
                  <dd className="mt-1 text-sm text-cream">{publicSite.address}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">
                    Instagram
                  </dt>
                  <dd className="mt-1 text-sm">
                    <a
                      href={publicSite.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand underline-offset-4 transition hover:underline"
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
              <WhatsAppButton size="lg" variant="outline">
                Falar com a {publicSite.name}
              </WhatsAppButton>
            </ActionRow>
          </div>
        </div>
      </Container>
    </div>
  );
}
