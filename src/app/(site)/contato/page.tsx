import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { IconArrowRight } from "@/components/site/icons";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { SiteLeadHit } from "@/lib/funnel-events";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import {
  PHONES,
  WHATSAPP_MESSAGES,
  emailChannelCopy,
  isPhysicalAddress,
  site,
  telUrl,
} from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Contato | ${site.name}`,
  description: `WhatsApp, telefone, e-mail e horário de atendimento online da ${site.name} em ${site.region} — todos os dias, das 8h às 23h.`,
  path: "/contato",
});

export default async function ContatoPage() {
  const publicSite = await getPublicSite();
  const physical = isPhysicalAddress(publicSite.address);
  const emailReady = !publicSite.email.includes("[");
  const emailCopy = emailChannelCopy(publicSite.email);
  const phone = PHONES[0];
  const sunday = publicSite.hoursSunday || publicSite.hoursWeekdays;
  const hourRows = [
    { label: "Segunda a sexta", value: publicSite.hoursWeekdays },
    { label: "Sábado", value: publicSite.hoursSaturday },
    { label: "Domingo e feriados", value: sunday },
  ];
  const sameHours = hourRows.every(
    (row) => row.value.trim() === hourRows[0]?.value.trim(),
  );

  return (
    <div data-clear-fab="" className="clear-fab-screen lg:py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Contato", path: "/contato" },
        ])}
      />
      <Container className="pt-5 lg:pt-0">
        <div className="mx-auto max-w-4xl">
          <PageHeader
            compact
            eyebrow="Contato"
            title={`Fale com a ${publicSite.name}`}
            description="Atendemos Linhares, Aracruz e Grande Vitória. Compare o estoque no assistente; fale com a equipe e feche no WhatsApp."
          />

          <section
            aria-labelledby="contato-whatsapp"
            className="mt-5 overflow-hidden bg-ink sm:mt-8"
          >
            <div className="h-1 bg-brand" aria-hidden="true" />
            <div className="p-5 sm:p-8">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                Canal da loja
              </p>
              <h2
                id="contato-whatsapp"
                className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream sm:text-2xl"
              >
                WhatsApp — resposta mais rápida
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream/80 sm:text-base">
                Para vídeo, financiamento e condições, troca ou fechamento, o canal é o WhatsApp.
              </p>

              <div className="mt-5">
                <SiteLeadHit contentName="Contato">
                  <WhatsAppButton
                    size="lg"
                    className="w-full"
                    trackingLabel="contato"
                    message={WHATSAPP_MESSAGES.general}
                  >
                    Chamar no WhatsApp
                  </WhatsAppButton>
                </SiteLeadHit>
              </div>

              {phone ? (
                <a
                  href={telUrl()}
                  className="group mt-4 flex min-h-[56px] items-center justify-between gap-3 bg-white/[0.04] px-4 py-3 touch-manipulation transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-cream/75">
                      Telefone
                    </span>
                    <span className="mt-1 block font-display text-2xl font-bold leading-none tracking-tight text-brand-light tabular-nums sm:text-3xl">
                      {phone.label}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-cream/90">
                    Ligar
                    <IconArrowRight className="h-4 w-4 text-brand-light transition group-hover:translate-x-0.5" />
                  </span>
                </a>
              ) : null}
            </div>
          </section>

          <section
            aria-labelledby="contato-outros-canais"
            className="mt-7 sm:mt-10 lg:mt-12"
          >
            <h2
              id="contato-outros-canais"
              className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-cream/80"
            >
              Outros canais e atendimento
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Channel
                label={physical ? "Endereço" : "Atendimento"}
                className="sm:col-span-2"
              >
                <p className="font-display text-base font-semibold text-cream">
                  {publicSite.address}
                </p>
                {physical ? null : (
                  <p className="mt-2 text-sm font-normal leading-relaxed text-cream/80">
                    Não temos showroom físico. Você escolhe no site, tira dúvidas e
                    pede vídeo pelo WhatsApp, e combinamos visita ao veículo, entrega
                    ou retirada. Atendemos Linhares, Aracruz e Grande Vitória.
                  </p>
                )}
              </Channel>
              <Channel label="Horário" className="sm:col-span-2">
                {sameHours ? (
                  <p className="font-display text-base font-semibold text-cream">
                    {publicSite.hours}
                  </p>
                ) : (
                  <dl className="space-y-1.5">
                    {hourRows.map((row) => (
                      <div key={row.label} className="flex justify-between gap-4">
                        <dt className="font-normal text-cream/75">{row.label}</dt>
                        <dd className="font-display font-semibold">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Channel>
              <Channel
                label="Instagram"
                href={publicSite.instagramUrl}
                external
              >
                <p className="font-display font-semibold">{publicSite.instagram}</p>
              </Channel>
              <Channel
                label={emailCopy.label}
                href={emailReady ? `mailto:${publicSite.email}` : undefined}
              >
                <p className="break-words font-display font-semibold">
                  {publicSite.email}
                </p>
                <p className="mt-1 text-xs font-normal leading-relaxed text-cream/75">
                  {emailCopy.hint}
                </p>
              </Channel>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-cream/75">
              {publicSite.legalName} — CNPJ {publicSite.cnpj}
            </p>
          </section>
        </div>
      </Container>
    </div>
  );
}

function Channel({
  label,
  href,
  external = false,
  className = "",
  children,
}: {
  label: string;
  href?: string;
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const interactive = Boolean(href);
  const classNames = `block min-h-[56px] bg-ink px-5 py-4 text-left text-sm leading-snug text-cream touch-manipulation ${
    interactive
      ? "group transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      : ""
  } ${className}`;
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cream/75">
          {label}
        </p>
        <div className="mt-1.5">{children}</div>
      </div>
      {interactive ? (
        <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-light transition group-hover:translate-x-0.5" />
      ) : null}
    </div>
  );

  if (!href) {
    return <div className={classNames}>{body}</div>;
  }

  return (
    <a
      href={href}
      className={classNames}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {body}
    </a>
  );
}
