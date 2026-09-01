import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import { VehicleConditions } from "@/components/site/VehicleConditions";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { StockBackLink } from "@/components/site/StockBackLink";
import { VehicleLeadHit, VehicleViewContent } from "@/components/site/VehiclePixel";
import { Container, WhatsAppButton } from "@/components/site/ui";
import { IconArrowRight } from "@/components/site/icons";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { GoogleReviewsBadge } from "@/components/site/GoogleReviewsBadge";
import { JsonLd } from "@/components/JsonLd";
import { formatCurrencyBRL, formatNumberBR, formatBrandName, formatModelName, formatVehicleLabel, formatListedAgo, vehicleSeoDescription } from "@/lib/format";
import { absoluteUrl, breadcrumbJsonLd, vehicleJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site, whatsappUrl } from "@/lib/site";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import { vehiclePath, vehicleSlug } from "@/lib/vehicle-slug";
import { getVehicleConditions, getGoogleReviews } from "@/lib/site-content";
import {
  getPublicVehicleStaticParams,
  getRelatedVehicles,
  getVehicleByParam,
} from "@/lib/vehicles";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return getPublicVehicleStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const vehicle = await getVehicleByParam(params.id);
  if (!vehicle) return { title: `Veículo não encontrado | ${site.name}` };

  const sold = vehicle.status === "vendido";
  const label = formatVehicleLabel(vehicle.brand, vehicle.model, vehicle.yearModel);
  const title = sold
    ? `${label} (vendido) | ${site.name}`
    : `${label} | ${site.name}`;
  const description = vehicleSeoDescription({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
    price: vehicle.price,
    km: vehicle.km,
    transmission: vehicle.transmission,
    sold,
    siteName: site.name,
  });
  const cover = vehicle.photos[0]?.url;
  const path = vehiclePath(vehicle);

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: sold ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(path),
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
  const vehicle = await getVehicleByParam(params.id);
  if (!vehicle) notFound();

  const canonicalSlug = vehicleSlug(vehicle);
  if (params.id !== canonicalSlug) {
    permanentRedirect(vehiclePath(vehicle));
  }

  const path = vehiclePath(vehicle);
  const sold = vehicle.status === "vendido";
  const title = formatVehicleLabel(vehicle.brand, vehicle.model);
  const fullLabel = `${title}${vehicle.version ? ` ${vehicle.version}` : ""} ${vehicle.yearModel}`;
  const galleryAlt = formatVehicleLabel(
    vehicle.brand,
    vehicle.model,
    vehicle.yearModel,
  );
  const [related, conditions, google] = await Promise.all([
    getRelatedVehicles(
      vehicle.id,
      vehicle.brand,
      4,
      vehicle.category,
      vehicle.price,
    ),
    getVehicleConditions(),
    getGoogleReviews(),
  ]);

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
      {!sold ? (
        <VehicleViewContent
          contentId={vehicle.id}
          contentName={fullLabel}
          value={vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
        />
      ) : null}
      <JsonLd data={vehicleJsonLd(vehicle)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Estoque", path: "/estoque" },
          { name: fullLabel, path },
        ])}
      />
      <Container>
        {sold ? (
          <div
            role="status"
            className="mb-4 border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 sm:px-5"
          >
            <p className="font-display text-sm font-semibold text-cream sm:text-base">
              Este veículo já foi vendido
            </p>
            <p className="mt-1 text-sm text-muted">
              A página permanece no ar para quem chegou por um link antigo.{" "}
              <Link
                href="/estoque"
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                Ver estoque disponível
              </Link>
            </p>
          </div>
        ) : null}

        <Suspense fallback={null}>
          <StockBackLink />
        </Suspense>
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
            <VehicleGallery photos={vehicle.photos} alt={galleryAlt} />
          </div>

          <aside className="order-2 lg:sticky lg:top-24 lg:row-span-2">
            <div className="space-y-4 border border-white/10 bg-ink p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-brand">
                  {vehicleCategoryLabel(vehicle.category)}
                </span>
                {sold ? (
                  <span className="bg-white/15 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider text-cream">
                    Vendido
                  </span>
                ) : vehicle.status === "reservado" ? (
                  <span className="bg-brand-orange px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider text-asphalt">
                    Reservado
                  </span>
                ) : null}
                {!sold ? (
                  <FavoriteButton
                    vehicleId={vehicle.id}
                    label={fullLabel}
                    value={vehicle.price}
                    make={formatBrandName(vehicle.brand)}
                    model={formatModelName(vehicle.model)}
                    year={vehicle.yearModel}
                    className="ml-auto"
                  />
                ) : null}
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
                {sold ? (
                  <span className="text-muted line-through decoration-white/30">
                    {formatCurrencyBRL(vehicle.price)}
                  </span>
                ) : (
                  formatCurrencyBRL(vehicle.price)
                )}
              </p>
              {vehicle.createdAt ? (
                <p className="text-xs text-muted">
                  {formatListedAgo(vehicle.createdAt)}
                </p>
              ) : null}
              {!sold ? (
                <GoogleReviewsBadge
                  reviews={google}
                  className="mt-0 border-white/10"
                />
              ) : null}

              <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-white/10 py-3.5 text-sm">
                {specs.map((spec) => (
                  <div key={spec.label} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wider text-muted">
                      {spec.label}
                    </dt>
                    {/* Sem truncate: valores como "Cautelar aprovado" precisam aparecer inteiros. */}
                    <dd className="mt-0.5 font-display text-sm font-semibold leading-snug text-cream [overflow-wrap:anywhere]">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {sold ? (
                <Link
                  href="/estoque"
                  className="inline-flex w-full min-h-[48px] items-center justify-center bg-brand px-5 font-display text-sm font-semibold uppercase tracking-wide text-asphalt transition hover:bg-brand-orange"
                >
                  Ver estoque disponível
                </Link>
              ) : (
                <>
                  <VehicleLeadHit
                    contentId={vehicle.id}
                    contentName={fullLabel}
                    value={vehicle.price}
                    make={formatBrandName(vehicle.brand)}
                    model={formatModelName(vehicle.model)}
                    year={vehicle.yearModel}
                  >
                    <WhatsAppButton
                      size="lg"
                      className="hidden w-full lg:inline-flex"
                      message={WHATSAPP_MESSAGES.vehicle(fullLabel)}
                    >
                      Tenho interesse
                    </WhatsAppButton>
                  </VehicleLeadHit>

                  {/* Vídeo e financiamento também no celular — antes só apareciam no desktop. */}
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                    <VehicleLeadHit
                      contentId={vehicle.id}
                      contentName={fullLabel}
                      value={vehicle.price}
                      make={formatBrandName(vehicle.brand)}
                      model={formatModelName(vehicle.model)}
                      year={vehicle.yearModel}
                    >
                      <a
                        href={whatsappUrl(WHATSAPP_MESSAGES.vehicleVideo(fullLabel))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[48px] items-center justify-center border border-white/15 px-3 text-center font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:border-brand lg:min-h-[44px]"
                      >
                        Pedir vídeo
                      </a>
                    </VehicleLeadHit>
                    <VehicleLeadHit
                      contentId={vehicle.id}
                      contentName={fullLabel}
                      value={vehicle.price}
                      make={formatBrandName(vehicle.brand)}
                      model={formatModelName(vehicle.model)}
                      year={vehicle.yearModel}
                    >
                      <a
                        href={whatsappUrl(
                          WHATSAPP_MESSAGES.vehicleFinance(fullLabel),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[48px] items-center justify-center border border-white/15 px-3 text-center font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:border-brand lg:min-h-[44px]"
                      >
                        Financiar
                      </a>
                    </VehicleLeadHit>
                    <VehicleLeadHit
                      contentId={vehicle.id}
                      contentName={fullLabel}
                      value={vehicle.price}
                      make={formatBrandName(vehicle.brand)}
                      model={formatModelName(vehicle.model)}
                      year={vehicle.yearModel}
                    >
                      <a
                        href={whatsappUrl(
                          WHATSAPP_MESSAGES.vehicleVisit(fullLabel),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center border border-white/15 px-3 text-center font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:border-brand lg:col-span-1 lg:min-h-[44px]"
                      >
                        Agendar visita
                      </a>
                    </VehicleLeadHit>
                  </div>

                  <VehicleLeadHit
                    contentId={vehicle.id}
                    contentName={fullLabel}
                    value={vehicle.price}
                    make={formatBrandName(vehicle.brand)}
                    model={formatModelName(vehicle.model)}
                    year={vehicle.yearModel}
                  >
                    <a
                      href={whatsappUrl(WHATSAPP_MESSAGES.vehicleTrade(fullLabel))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full min-h-[48px] items-center justify-center border border-white/15 px-3 text-center font-display text-[11px] font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:border-brand lg:min-h-[44px]"
                    >
                      Quero dar na troca
                    </a>
                  </VehicleLeadHit>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                    <Link
                      href={`/vender?interesse=${vehicle.id}&label=${encodeURIComponent(fullLabel)}`}
                      className="min-h-[44px] inline-flex items-center text-muted underline-offset-4 transition hover:text-cream hover:underline"
                    >
                      Ou preencha a avaliação do seu usado
                    </Link>
                  </div>
                </>
              )}

              {!sold ? (
                <VehicleConditions
                  vehicleWarranty={vehicle.warranty}
                  conditions={conditions}
                />
              ) : null}

              <ShareVehicle
                title={fullLabel}
                path={path}
                className="border-t border-white/10 pt-3"
              />

              <p className="text-xs leading-relaxed text-muted">
                {sold
                  ? "Este anúncio não está mais à venda. Confira outras opções no estoque."
                  : `Valores e disponibilidade sujeitos a alteração. Financiamento pelo WhatsApp ${site.whatsappLabel}.`}
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
                {sold ? "Veja opções disponíveis" : "Você também pode gostar"}
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
        vehicleId={vehicle.id}
        contentName={fullLabel}
        brand={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        year={vehicle.yearModel}
        price={vehicle.price}
        sold={sold}
      />
    </div>
  );
}
