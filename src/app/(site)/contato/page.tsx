import type { Metadata } from "next";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import {
  IconClock,
  IconInstagram,
  IconMail,
  IconMapPin,
  IconPhone,
} from "@/components/site/icons";
import { PHONES, WHATSAPP_MESSAGES, site, telUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contato | ${site.name}`,
  description: `Endereço, telefone, WhatsApp e horário de atendimento da ${site.name}.`,
  alternates: { canonical: "/contato" },
};

/**
 * O iframe usa o modo de busca do Google Maps, que funciona sem API key.
 * Troque `site.address` pelo endereço real e o mapa se ajusta sozinho.
 */
const mapsQuery = encodeURIComponent(`${site.name} ${site.address}`);
const mapsEmbedUrl = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
const mapsLinkUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

export default function ContatoPage() {
  return (
    <div className="py-12 lg:py-16">
      <Container size="narrow">
        <PageHeader
          eyebrow="Contato"
          title={`Fale com a ${site.name}`}
          description="Atendemos por WhatsApp, telefone e também na loja. Se quiser ver um veículo de perto, agende sua visita que a gente separa o carro para você."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PHONES.map((phone, index) => (
            <InfoCard
              key={phone.digits}
              Icon={IconPhone}
              label={index === 0 ? "Telefone / WhatsApp" : "Telefone 2 / WhatsApp"}
              value={phone.label}
              href={telUrl(index)}
              hrefLabel="Ligar agora"
            />
          ))}
          <InfoCard
            Icon={IconMapPin}
            label="Endereço"
            value={site.address}
            href={mapsLinkUrl}
            hrefLabel="Abrir no Google Maps"
            external
          />
          <InfoCard
            Icon={IconInstagram}
            label="Instagram"
            value={site.instagram}
            href={site.instagramUrl}
            hrefLabel="Ver perfil"
            external
          />
          <InfoCard
            Icon={IconMail}
            label="E-mail"
            value={site.email}
            href={`mailto:${site.email}`}
            hrefLabel="Enviar e-mail"
          />
          <div className="flex flex-col items-center border border-white/10 bg-ink p-6 text-center">
            <IconClock className="h-6 w-6 shrink-0 text-brand" />
            <h2 className="mt-3 font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Horário de atendimento
            </h2>
            <dl className="mt-4 w-full space-y-2 text-sm">
              <HourRow label="Segunda a sexta" value={site.hoursWeekdays} />
              <HourRow label="Sábado" value={site.hoursSaturday} />
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
              title={`Mapa da ${site.name}`}
              src={mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0 grayscale-[35%]"
            />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-muted">
            Endereço ainda em configuração ({site.address}) — o mapa passa a
            apontar o ponto exato assim que o endereço real for preenchido em{" "}
            <code className="text-cream">src/lib/site.ts</code>.
          </p>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-muted">
          {site.legalName} — CNPJ {site.cnpj}
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
