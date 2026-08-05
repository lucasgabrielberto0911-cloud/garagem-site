import type { Metadata } from "next";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import {
  IconClock,
  IconInstagram,
  IconMail,
  IconMapPin,
  IconPhone,
} from "@/components/site/icons";
import {
  PHONES,
  WHATSAPP_MESSAGES,
  site,
  telUrl,
  whatsappUrl,
} from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Contato | ${site.name}`,
  description: `Endereço, telefone, WhatsApp e horário de atendimento da ${site.name}.`,
  alternates: { canonical: "/contato" },
};

export default async function ContatoPage() {
  const publicSite = await getPublicSite();
  const addressReady = !publicSite.address.includes("[");
  const mapsQuery = encodeURIComponent(
    `${publicSite.name} ${addressReady ? publicSite.address : publicSite.state}`,
  );
  const mapsEmbedUrl = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsLinkUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const emailReady = !publicSite.email.includes("[");

  return (
    <div className="py-12 lg:py-16">
      <Container size="narrow">
        <PageHeader
          eyebrow="Contato"
          title={`Fale com a ${publicSite.name}`}
          description="Atendemos por WhatsApp, telefone e também na loja. Se quiser ver um veículo de perto, agende sua visita que a gente separa o carro para você."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PHONES.map((phone, index) => (
            <InfoCard
              key={phone.digits}
              Icon={IconPhone}
              label={
                index === 0 ? "Telefone / WhatsApp" : "Telefone 2 / WhatsApp"
              }
              value={phone.label}
              href={telUrl(index)}
              hrefLabel="Ligar agora"
            />
          ))}
          <InfoCard
            Icon={IconMapPin}
            label="Endereço"
            value={publicSite.address}
            href={mapsLinkUrl}
            hrefLabel="Abrir no Google Maps"
            external
          />
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
          <div className="flex flex-col items-center border border-white/10 bg-ink p-6 text-center">
            <IconClock className="h-6 w-6 shrink-0 text-brand" />
            <h2 className="mt-3 font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Horário de atendimento
            </h2>
            <dl className="mt-4 w-full space-y-2 text-sm">
              <HourRow
                label="Segunda a sexta"
                value={publicSite.hoursWeekdays}
              />
              <HourRow label="Sábado" value={publicSite.hoursSaturday} />
              <HourRow label="Domingo e feriados" value="Fechado" />
            </dl>
          </div>
        </div>

        <div className="mt-8 border border-brand/40 bg-ink p-8 text-center">
          <p className="font-display text-lg font-semibold text-cream">
            Resposta mais rápida é no WhatsApp
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Mande sua dúvida que a gente responde no horário de atendimento.
          </p>
          <WhatsAppButton
            className="mt-6"
            size="lg"
            message={WHATSAPP_MESSAGES.visit}
          >
            Chamar no WhatsApp
          </WhatsAppButton>
        </div>

        <div className="mt-8">
          <div className="relative aspect-[4/3] overflow-hidden border border-white/10 bg-ink sm:aspect-[16/9]">
            <iframe
              title={`Mapa da ${publicSite.name}`}
              src={mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0 grayscale-[35%]"
            />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-muted">
            {addressReady
              ? `Mapa baseado em ${publicSite.address}.`
              : "Endereço ainda em configuração — preencha em Painel → Dados do site para o mapa apontar o ponto exato."}
          </p>
        </div>

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
  href: string;
  hrefLabel: string;
  external?: boolean;
}) {
  return (
    <div className="flex flex-col items-center border border-white/10 bg-ink p-6 text-center">
      <Icon className="h-6 w-6 shrink-0 text-brand" />
      <h2 className="mt-3 font-display text-sm font-semibold uppercase tracking-wider text-cream">
        {label}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{value}</p>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="mt-4 inline-block text-xs font-semibold uppercase tracking-wider text-brand underline-offset-4 transition hover:underline"
      >
        {hrefLabel}
      </a>
    </div>
  );
}
