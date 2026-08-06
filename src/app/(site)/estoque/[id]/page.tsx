import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { Container, WhatsAppButton } from "@/components/site/ui";
import { IconArrowRight } from "@/components/site/icons";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { JsonLd } from "@/components/JsonLd";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { absoluteUrl, breadcrumbJsonLd, vehicleJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site, whatsappUrl } from "@/lib/site";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import { getRelatedVehicles, getVehicleById } from "@/lib/vehicles";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const vehicle = await getVehicleById(params.id);
  if (!vehicle) return { title: `Veículo não encontrado | ${site.name}` };

  const title = `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel} | ${site.name}`;
  const description =
    vehicle.description ??
    `${vehicle.brand} ${vehicle.model} ${vehicle.year}/${vehicle.yearModel} com ${formatNumberBR(vehicle.km)} km disponível na ${site.name}.`;
  const cover = vehicle.photos[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/estoque/${vehicle.id}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/estoque/${vehicle.id}`),
      images: cover ? [{ url: cover }] : ["/og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cover ? [cover] : ["/og.png"],
    },
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const vehicle = await getVehicleById(params.id);
  if (!vehicle) notFound();

  const title = `${vehicle.brand} ${vehicle.model}`;
  const fullLabel = `${title}${vehicle.version ? ` ${vehicle.version}` : ""} ${vehicle.yearModel}`;
  const related = await getRelatedVehicles(
    vehicle.id,
    vehicle.brand,
    4,
    vehicle.category,
    vehicle.price,
  );

  const specs = [
    { label: "Tipo", value: vehicleCategoryLabel(vehicle.category) },
    { label: "Ano", value: `${vehicle.year}/${vehicle.yearModel}` },
    { label: "KM", value: formatNumberBR(vehicle.km) },
    { label: "Câmbio", value: vehicle.transmission },
    { label: "Combustível", value: vehicle.fuel },
    ...(vehicle.color ? [{ label: "Cor", value: vehicle.color }] : []),
    ...(vehicle.engine ? [{ label: "Motor", value: vehicle.engine }] : []),
    ...(vehicle.doors != null
      ? [{ label: "Portas", value: String(vehicle.doors) }]
      : []),
    ...(vehicle.plateEnd
      ? [{ label: "Final placa", value: vehicle.plateEnd }]
      : []),
    ...(vehicle.warranty
      ? [{ label: "Garantia", value: vehicle.warranty }]
      : []),
    ...(vehicle.inspection
      ? [{ label: "Laudo", value: vehicle.inspection }]
      : []),
  ];

  const hasDetails =
    Boolean(vehicle.description) || vehicle.accessories.length > 0;

  return (
    <div className="py-6 pb-sticky-bar-safe sm:py-8 lg:py-10 lg:pb-10">
      <JsonLd data={vehicleJsonLd(vehicle)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Estoque", path: "/estoque" },
          { name: fullLabel, path: `/estoque/${vehicle.id}` },
        ])}
      />
      <Container>
        <nav
          aria-label="Você está aqui"
          className="text-xs text-muted sm:text-center"
        >
          <Link href="/" className="transition hover:text-cream">
            Início
          </Link>
          <span className="mx-2">/</span>
          <Link href="/estoque" className="transition hover:text-cream">
            Estoque
          </Link>
          <span className="mx-2">/</span>
          <span className="text-cream">{title}</span>
        </nav>

        {/* Mobile: galeria → ficha → detalhes. Desktop: galeria+detalhes | ficha. */}
        <div className="mt-4 grid gap-5 lg:mt-5 lg:grid-cols-[1.35fr_0.9fr] lg:items-start lg:gap-8">
          <div className="order-1 min-w-0">
            <VehicleGallery photos={vehicle.photos} alt={fullLabel} />
          </div>

          <aside className="order-2 lg:sticky lg:top-24 lg:row-span-2">
            <div className="space-y-4 border border-white/10 bg-ink p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-brand">
                  {vehicleCategoryLabel(vehicle.category)}
                </span>
                {vehicle.status === "reservado" ? (
                  <span className="bg-brand-orange px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider text-asphalt">
                    Reservado
                  </span>
                ) : null}
                <FavoriteButton
                  vehicleId={vehicle.id}
                  label={fullLabel}
                  className="ml-auto"
                />
              </div>

              <div>
                <h1 className="font-display text-[1.65rem] font-bold leading-tight tracking-tight text-cream sm:text-2xl sm:text-[1.75rem]">
                  {title}
                </h1>
                {vehicle.version ? (
                  <p className="mt-1 text-sm text-muted">{vehicle.version}</p>
                ) : null}
              </div>

              <p className="font-display text-3xl font-bold leading-none text-cream">
                {formatCurrencyBRL(vehicle.price)}
              </p>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-white/10 py-3.5 text-sm">
                {specs.map((spec) => (
                  <div key={spec.label} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">
                      {spec.label}
                    </dt>
                    <dd className="mt-0.5 truncate font-display text-sm font-semibold text-cream">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <WhatsAppButton
                size="lg"
                className="hidden w-full lg:inline-flex"
                message={WHATSAPP_MESSAGES.vehicle(fullLabel)}
              >
                Falar no WhatsApp
              </WhatsAppButton>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                <Link
                  href="/vender"
                  className="min-h-[44px] inline-flex items-center text-muted underline-offset-4 transition hover:text-cream hover:underline"
                >
                  Quero colocar meu veículo na troca
                </Link>
                <a
                  href={whatsappUrl(WHATSAPP_MESSAGES.vehicleVideo(fullLabel))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] inline-flex items-center text-muted underline-offset-4 transition hover:text-cream hover:underline"
                >
                  Pedir vídeo
                </a>
              </div>

              <ShareVehicle
                title={fullLabel}
                path={`/estoque/${vehicle.id}`}
                className="border-t border-white/10 pt-3"
              />

              <p className="text-xs leading-relaxed text-muted">
                Valores e disponibilidade sujeitos a alteração. Financiamento
                pelo WhatsApp {site.whatsappLabel}.
              </p>
            </div>
          </aside>

          {hasDetails ? (
            <section className="order-3 border-t border-white/10 pt-5 lg:col-start-1">
              {vehicle.description ? (
                <div>
                  <h2 className="font-display text-base font-semibold text-cream">
                    Sobre o veículo
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted sm:text-[15px]">
                    {vehicle.description}
                  </p>
                </div>
              ) : null}

              {vehicle.accessories.length > 0 ? (
                <div className={vehicle.description ? "mt-5" : undefined}>
                  <h2 className="font-display text-base font-semibold text-cream">
                    Itens e acessórios
                  </h2>
                  <ul className="mt-3 columns-1 gap-x-8 text-sm text-cream/90 sm:columns-2">
                    {vehicle.accessories.map((item) => (
                      <li
                        key={item}
                        className="mb-1.5 flex break-inside-avoid items-start gap-2"
                      >
                        <span
                          className="mt-2 h-1 w-1 shrink-0 bg-brand"
                          aria-hidden="true"
                        />
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        {related.length > 0 ? (
          <section className="mt-10 border-t border-white/5 pt-8 sm:mt-12 sm:pt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-lg font-bold tracking-tight text-cream sm:text-xl">
                Você também pode gostar
              </h2>
              <Link
                href="/estoque"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
              >
                Ver estoque
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-5">
              <VehicleGrid vehicles={related} />
            </div>
          </section>
        ) : null}
      </Container>

      <VehicleMobileBar
        brand={vehicle.brand}
        model={vehicle.model}
        year={vehicle.yearModel}
        price={vehicle.price}
      />
    </div>
  );
}
