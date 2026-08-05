import type { Metadata } from "next";
import { WhatsAppButton } from "@/components/site/ui";
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
    <div className="px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Contato
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
            Fale com a {site.name}
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Atendemos por WhatsApp, telefone e também na loja. Se quiser ver um
            veículo de perto, agende sua visita que a gente separa o carro para
            você.
          </p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <InfoCard
              Icon={IconMapPin}
              label="Endereço"
              value={site.address}
              href={mapsLinkUrl}
              hrefLabel="Abrir no Google Maps"
              external
            />
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
              Icon={IconMail}
              label="E-mail"
              value={site.email}
              href={`mailto:${site.email}`}
              hrefLabel="Enviar e-mail"
            />
            <InfoCard
              Icon={IconInstagram}
              label="Instagram"
              value={site.instagram}
              href={site.instagramUrl}
              hrefLabel="Ver perfil"
              external
            />

            <div className="border border-white/10 bg-ink p-6">
              <div className="flex items-center gap-3">
                <IconClock className="h-5 w-5 shrink-0 text-brand" />
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
                  Horário de atendimento
                </h2>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Segunda a sexta</dt>
                  <dd className="text-cream">{site.hoursWeekdays}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Sábado</dt>
                  <dd className="text-cream">{site.hoursSaturday}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Domingo e feriados</dt>
                  <dd className="text-cream">Fechado</dd>
                </div>
              </dl>
            </div>

            <div className="border border-brand/40 bg-ink p-6 text-center">
              <p className="font-display text-base font-semibold text-cream">
                Resposta mais rápida é no WhatsApp
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Mande sua dúvida que a gente responde no horário de atendimento.
              </p>
              <WhatsAppButton
                className="mt-5 w-full"
                size="lg"
                message={WHATSAPP_MESSAGES.visit}
              >
                Chamar no WhatsApp
              </WhatsAppButton>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              {site.legalName} — CNPJ {site.cnpj}
            </p>
          </div>

          <div>
            <div className="relative aspect-square overflow-hidden border border-white/10 bg-ink lg:aspect-auto lg:h-full lg:min-h-[520px]">
              <iframe
                title={`Mapa da ${site.name}`}
                src={mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0 grayscale-[35%]"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Endereço ainda em configuração ({site.address}) — o mapa passa a
              apontar o ponto exato assim que o endereço real for preenchido em{" "}
              <code className="text-cream">src/lib/site.ts</code>.
            </p>
          </div>
        </div>
      </div>
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
    <div className="border border-white/10 bg-ink p-6">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-brand" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
          {label}
        </h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{value}</p>
      <a
        href={href}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className="mt-3 inline-block text-xs font-semibold uppercase tracking-wider text-brand underline-offset-4 transition hover:underline"
      >
        {hrefLabel}
      </a>
    </div>
  );
}
