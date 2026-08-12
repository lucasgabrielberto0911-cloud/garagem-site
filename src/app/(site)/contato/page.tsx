import type { Metadata } from "next";
import {
  Container,
  PageHeader,
  WhatsAppButton,
} from "@/components/site/ui";
import {
  IconClock,
  IconInstagram,
  IconMail,
  IconMapPin,
  IconPhone,
  IconWhatsApp,
} from "@/components/site/icons";
import { buildPageMetadata } from "@/lib/seo";
import {
  PHONES,
  WHATSAPP_MESSAGES,
  isPhysicalAddress,
  site,
  telUrl,
  whatsappUrl,
} from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";

export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: `Contato | ${site.name}`,
  description: `WhatsApp, telefone, e-mail e horário de atendimento online da ${site.name} em Aracruz, Vitória, Linhares e região — todos os dias, das 8h às 23h.`,
  path: "/contato",
});

export default async function ContatoPage() {
  const publicSite = await getPublicSite();
  const physical = isPhysicalAddress(publicSite.address);
  const emailReady = !publicSite.email.includes("[");

  return (
    <div className="py-12 lg:py-16">
      <Container size="narrow">
        <PageHeader
          eyebrow="Contato"
          title={`Fale com a ${publicSite.name}`}
          description={`Somos loja digital e atendemos ${publicSite.region} e região — todos os dias, das 8h às 23h. O canal mais rápido é o WhatsApp.`}
        />

        {/* Canal dominante */}
        <div className="relative mt-10 overflow-hidden border border-[#25D366]/40 bg-ink p-7 text-center sm:mt-12 sm:p-10">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-[#25D366]"
            aria-hidden="true"
          />
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]">
            <IconWhatsApp className="h-8 w-8" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
            WhatsApp — resposta mais rápida
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
            Tire dúvidas, peça vídeo do carro ou avalie troca. Estamos online
            das 8h às 23h, todos os dias.
          </p>
          <WhatsAppButton
            className="mt-6"
            size="lg"
            message={WHATSAPP_MESSAGES.visit}
          >
            Chamar no WhatsApp
          </WhatsAppButton>
          <p className="mt-4 text-xs text-muted">{PHONES[0]?.label}</p>
        </div>

        <h2 className="mt-12 text-center font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted">
          Outros canais
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {PHONES.map((phone, index) => (
            <InfoCard
              key={phone.digits}
              Icon={IconPhone}
              label={index === 0 ? "Telefone" : "Telefone 2"}
              value={phone.label}
              href={telUrl(index)}
              hrefLabel="Ligar agora"
            />
          ))}
          <InfoCard
            Icon={IconInstagram}
            label="Instagram"
            value={publicSite.instagram}
            href={publicSite.instagramUrl}
            hrefLabel="Ver perfil"
            external
          />
          <InfoCard
            Icon={IconMail}
            label="E-mail"
            value={publicSite.email}
            href={
              emailReady
                ? `mailto:${publicSite.email}`
                : whatsappUrl(WHATSAPP_MESSAGES.general)
            }
            hrefLabel={emailReady ? "Enviar e-mail" : "Chamar no WhatsApp"}
            external={!emailReady}
          />
          <InfoCard
            Icon={IconMapPin}
            label={physical ? "Endereço" : "Atendimento"}
            value={publicSite.address}
            href={physical ? undefined : whatsappUrl(WHATSAPP_MESSAGES.visit)}
            hrefLabel={physical ? undefined : "Falar com a gente"}
            external={!physical}
          />
          <div className="flex flex-col items-center border border-white/10 bg-ink p-6 text-center sm:col-span-2">
            <IconClock className="h-6 w-6 shrink-0 text-brand" />
            <h3 className="mt-3 font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Horário de atendimento online
            </h3>
            <p className="mt-3 text-sm text-muted">{publicSite.hours}</p>
            <dl className="mx-auto mt-5 w-full max-w-md space-y-2 text-sm">
              <HourRow label="Segunda a sexta" value={publicSite.hoursWeekdays} />
              <HourRow label="Sábado" value={publicSite.hoursSaturday} />
              <HourRow
                label="Domingo e feriados"
                value={publicSite.hoursSunday || publicSite.hoursWeekdays}
              />
            </dl>
          </div>
        </div>

        {!physical ? (
          <div className="mt-8 border border-dashed border-white/15 bg-ink/40 px-6 py-10 text-center">
            <IconMapPin className="mx-auto h-8 w-8 text-brand/70" />
            <p className="mt-4 font-display text-base font-semibold text-cream">
              Loja 100% digital
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Ainda não temos showroom físico. O estoque está no site e o
              atendimento é online — com vídeo, avaliação e suporte até a
              documentação. Atendemos {publicSite.region} e região.
            </p>
          </div>
        ) : null}

        <p className="mt-8 text-center text-xs leading-relaxed text-muted">
          {publicSite.legalName} — CNPJ {publicSite.cnpj}
        </p>
      </Container>
    </div>
  );
}

function HourRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-cream">{value}</dd>
    </div>
  );
}

function InfoCard({
  Icon,
  label,
  value,
  href,
  hrefLabel,
  external = false,
}: {
  Icon: (props: { className?: string }) => JSX.Element;
  label: string;
  value: string;
  href?: string;
  hrefLabel?: string;
  external?: boolean;
}) {
  return (
    <div className="flex flex-col items-center border border-white/10 bg-ink p-5 text-center sm:p-6">
      <Icon className="h-6 w-6 shrink-0 text-brand" />
      <h3 className="mt-3 font-display text-sm font-semibold uppercase tracking-wider text-cream">
        {label}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{value}</p>
      {href && hrefLabel ? (
        <a
          href={href}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center border border-white/20 px-4 font-display text-xs font-semibold uppercase tracking-wider text-cream/90 transition hover:border-brand hover:bg-brand/10 touch-manipulation"
        >
          {hrefLabel}
        </a>
      ) : null}
    </div>
  );
}
