import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { VehicleImage } from "@/components/VehicleImage";
import { TrackedWhatsAppLink } from "@/components/site/TrackedWhatsAppLink";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { IconArrowRight, IconStar, IconWhatsApp } from "@/components/site/icons";
import {
  ButtonLink,
  Container,
  PageHeader,
  Section,
  SectionHeading,
  WhatsAppButton,
} from "@/components/site/ui";
import { formatNumberBR } from "@/lib/format";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getSoldShowcaseData } from "@/lib/sold-showcase";
import { CARD_SIZES } from "@/lib/stock-query";
import { getSiteStats } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Veículos vendidos e entregas | ${site.name}`,
  description: `Confira fotos reais de clientes com seus seminovos entregues e o histórico recente de veículos vendidos pela ${site.name} no Espírito Santo.`,
  path: "/vendidos",
});

export default async function VendidosPage() {
  const [{ deliveries, vehicles }, stats] = await Promise.all([
    getSoldShowcaseData({ deliveriesTake: 24, vehiclesTake: 24 }),
    getSiteStats(),
  ]);

  const hasAny = deliveries.length > 0 || vehicles.length > 0;
  const soldLabel =
    stats.sales > 0 ? `+${formatNumberBR(stats.sales)} veículos vendidos` : null;

  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Veículos vendidos", path: "/vendidos" },
        ])}
      />

      <Container>
        <PageHeader
          eyebrow="Entregas e histórico"
          title="Veículos vendidos e clientes"
          description={`Negócios fechados pela ${site.name} no Espírito Santo. Quer um modelo parecido? Fale com a loja pelo WhatsApp.`}
        />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {soldLabel ? (
            <span className="inline-flex min-h-10 items-center border border-white/15 bg-ink px-4 font-display text-xs font-semibold uppercase tracking-wider text-cream">
              {soldLabel}
            </span>
          ) : null}
          <Link
            href="/estoque"
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-2 border border-brand/40 bg-brand/10 px-4 font-display text-xs font-semibold uppercase tracking-wider text-brand-light transition hover:border-brand hover:text-cream"
          >
            Ver estoque disponível
            <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!hasAny ? (
          <div className="mx-auto mt-10 max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold text-cream">
              Galeria de entregas em atualização
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Em breve, novas fotos de clientes e veículos entregues aparecem
              aqui. Confira os seminovos disponíveis agora no estoque.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/estoque" size="md">
                Ver estoque disponível
              </ButtonLink>
              <WhatsAppButton
                trackingLabel="vendidos-vazio"
                message={WHATSAPP_MESSAGES.help}
                size="md"
              >
                Falar no WhatsApp
              </WhatsAppButton>
            </div>
          </div>
        ) : null}
      </Container>

      {deliveries.length > 0 ? (
        <Section spacing="tight" className="mt-8 border-t border-white/10">
          <div data-sold-showcase="">
          <SectionHeading
            eyebrow="Clientes"
            title="Entregas registradas"
            description="Fotos de quem já fechou negócio com a Garagem."
          />

          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deliveries.map((item, index) => (
              <li
                key={item.id}
                className="flex flex-col overflow-hidden border border-white/10 bg-ink"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-asphalt">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto pública via R2/Storage */}
                  <img
                    src={item.photoSrc}
                    alt={
                      item.vehicleLabel
                        ? `${item.customerName} com ${item.vehicleLabel}`
                        : `Entrega para ${item.customerName}`
                    }
                    width={640}
                    height={480}
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {item.vehicleLabel ? (
                    <span className="absolute bottom-2.5 left-2.5 bg-asphalt/90 px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-wide text-cream">
                      {item.vehicleLabel}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display text-base font-semibold text-cream">
                      {item.customerName}
                    </p>
                    {item.message ? (
                      <span
                        className="flex shrink-0 items-center gap-0.5 text-brand-light"
                        role="img"
                        aria-label={`${item.rating} de 5`}
                      >
                        {([1, 2, 3, 4, 5] as const).map((star) => (
                          <IconStar
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= item.rating ? "text-brand-light" : "text-white/15"
                            }`}
                          />
                        ))}
                      </span>
                    ) : null}
                  </div>

                  {(item.city || item.dateLabel) ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {[item.city, item.dateLabel].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}

                  {item.message ? (
                    <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-cream/85">
                      {item.message}
                    </blockquote>
                  ) : (
                    <div className="flex-1" />
                  )}

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <TrackedWhatsAppLink
                      href={item.whatsappHref}
                      trackingLabel="vendidos-entrega"
                      className="inline-flex min-h-11 items-center gap-2 font-display text-xs font-semibold uppercase tracking-wider text-brand-light transition hover:text-cream"
                    >
                      <IconWhatsApp className="h-4 w-4" />
                      Quero um parecido
                    </TrackedWhatsAppLink>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          </div>
        </Section>
      ) : null}

      {vehicles.length > 0 ? (
        <Section spacing="tight" className="border-t border-white/10 bg-ink/30">
          <div data-sold-showcase="">
          <SectionHeading
            eyebrow="Histórico"
            title="Veículos vendidos recentemente"
            description="Unidades já entregues. Gostou de algum modelo? Chamamos você quando entrar outro parecido."
          />

          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {vehicles.map((vehicle, index) => (
              <li
                key={vehicle.id}
                className="flex flex-col overflow-hidden border border-white/10 bg-asphalt"
              >
                <Link
                  href={vehicle.path}
                  prefetch={false}
                  className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
                    <VehicleImage
                      src={vehicle.cover}
                      srcSet={vehicle.srcSet}
                      mobileSrcSet={vehicle.mobileSrcSet}
                      alt={vehicle.title}
                      fill
                      width={480}
                      height={360}
                      sizes={CARD_SIZES}
                      priority={deliveries.length === 0 && index === 0}
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute left-2 top-2 bg-asphalt/90 px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
                      Vendido
                    </span>
                  </div>

                  <div className="p-3 sm:p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      {vehicle.brand}
                    </p>
                    <h3 className="mt-0.5 truncate font-display text-sm font-semibold text-cream sm:text-base">
                      {vehicle.model}
                    </h3>
                    {vehicle.version ? (
                      <p className="truncate text-xs text-muted">
                        {vehicle.version}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-cream/80">
                      {vehicle.yearModel} · {vehicle.kmLabel} · {vehicle.transmission}
                    </p>
                  </div>
                </Link>

                <div className="mt-auto border-t border-white/10 px-3 py-2 sm:px-4">
                  <TrackedWhatsAppLink
                    href={vehicle.whatsappHref}
                    trackingLabel="vendidos-similar"
                    vehicleId={vehicle.id}
                    slug={vehicle.path}
                    className="inline-flex min-h-10 w-full items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-brand-light transition hover:text-cream"
                  >
                    <IconWhatsApp className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Quero um parecido</span>
                  </TrackedWhatsAppLink>
                </div>
              </li>
            ))}
          </ul>
          </div>
        </Section>
      ) : null}

      <Container className="mt-10">
        <WantedVehicleCta />
      </Container>
    </div>
  );
}
