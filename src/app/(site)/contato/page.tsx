import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { buildPageMetadata } from "@/lib/seo";
import {
  PHONES,
  WHATSAPP_MESSAGES,
  emailChannelCopy,
  isPhysicalAddress,
  site,
  telUrl,
} from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";

export const revalidate = 600;

export const metadata: Metadata = buildPageMetadata({
  title: `Contato | ${site.name}`,
  description: `WhatsApp, telefone, e-mail e horário de atendimento online da ${site.name} em ${site.region} e região — todos os dias, das 8h às 23h.`,
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
    <div data-clear-fab="">
      <div className="clear-fab-screen lg:py-12">
        <Container size="narrow" className="pt-5 lg:pt-0">
          <PageHeader
            compact
            eyebrow="Contato"
            title={`Fale com a ${publicSite.name}`}
            description={`Somos loja digital e atendemos ${publicSite.region} e região — todos os dias, das 8h às 23h. Compare o estoque no assistente; simule e feche no WhatsApp.`}
          />

          <section
            aria-labelledby="contato-whatsapp"
            className="mt-4 overflow-hidden border border-white/10 bg-ink sm:mt-8"
          >
            <div className="h-1 bg-brand" aria-hidden="true" />
            <div className="p-3.5 sm:p-6">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                Canal da loja
              </p>
              <h2
                id="contato-whatsapp"
                className="mt-1 font-display text-lg font-bold tracking-tight text-cream sm:mt-2 sm:text-2xl"
              >
                WhatsApp — resposta mais rápida
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-snug text-muted sm:text-base sm:leading-relaxed">
                Para vídeo, parcela, troca ou fechamento, o canal é o WhatsApp.
              </p>

              {phone ? (
                <a
                  href={telUrl()}
                  className="mt-3 flex min-h-[56px] items-center justify-between gap-3 border border-white/10 bg-asphalt px-3.5 py-2.5 touch-manipulation transition hover:border-brand"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Telefone
                    </span>
                    <span className="mt-1 block font-display text-[1.65rem] font-bold leading-none tracking-tight text-brand sm:text-3xl">
                      {phone.label}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-[11px] font-semibold uppercase tracking-wide text-cream/80">
                    Ligar
                  </span>
                </a>
              ) : null}

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="border border-white/10 bg-asphalt px-3.5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Horário
                  </p>
                  <p className="mt-0.5 font-display text-sm font-semibold leading-snug text-cream">
                    {publicSite.hours}
                  </p>
                </div>
                <div className="border border-white/10 bg-asphalt px-3.5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {physical ? "Endereço" : "Atendimento"}
                  </p>
                  <p className="mt-0.5 font-display text-sm font-semibold leading-snug text-cream">
                    {publicSite.address}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <WhatsAppButton
                  size="lg"
                  className="w-full"
                  trackingLabel="contato"
                  message={WHATSAPP_MESSAGES.visit}
                >
                  Chamar no WhatsApp
                </WhatsAppButton>
              </div>
            </div>
          </section>
        </Container>
      </div>

      <Container size="narrow" className="mt-6 pb-8 lg:mt-0 lg:pb-12">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Outros canais
        </h2>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          <Channel
            label={physical ? "Endereço" : "Atendimento"}
            className="sm:col-span-2"
          >
            <p className="font-display font-semibold">{publicSite.address}</p>
            {physical ? null : (
              <p className="mt-2 text-sm font-normal leading-relaxed text-muted">
                Não temos showroom físico. Você escolhe no site, tira dúvidas e
                pede vídeo pelo WhatsApp, e combinamos visita ao veículo, entrega
                ou retirada. Atendimento online todos os dias, das 8h às 23h, em{" "}
                {publicSite.region} e região.
              </p>
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
            <p className="break-all font-display font-semibold">
              {publicSite.email}
            </p>
            <p className="mt-1 text-xs font-normal leading-relaxed text-muted">
              {emailCopy.hint}
            </p>
          </Channel>
          <Channel label="Horário" className="sm:col-span-2">
            {sameHours ? (
              <p className="font-display font-semibold">{publicSite.hours}</p>
            ) : (
              <dl className="space-y-1.5">
                {hourRows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4">
                    <dt className="font-normal text-muted">{row.label}</dt>
                    <dd className="font-display font-semibold">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Channel>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          {publicSite.legalName} — CNPJ {publicSite.cnpj}
        </p>
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
  const classNames = `block min-h-[52px] border border-white/10 bg-ink px-3 py-3 text-left text-sm leading-snug text-cream touch-manipulation ${
    href ? "transition hover:border-brand" : ""
  } ${className}`;
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </>
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
