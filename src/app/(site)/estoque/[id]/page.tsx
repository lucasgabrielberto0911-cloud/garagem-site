import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import {
  VehicleMobileBlocks,
  VehicleMobileSummary,
} from "@/components/site/VehicleMobileDossier";
import { VehicleConditions } from "@/components/site/VehicleConditions";
import { VehicleDescription } from "@/components/site/VehicleDescription";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { StockBackLink } from "@/components/site/StockBackLink";
import { VehicleLeadHit, VehicleViewContent } from "@/components/site/VehiclePixel";
import { Container, WhatsAppButton } from "@/components/site/ui";
import { IconArrowRight } from "@/components/site/icons";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { GoogleReviewsBadge } from "@/components/site/GoogleReviewsBadge";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleChatContext } from "@/components/site/VehicleChatContext";
import { JsonLd } from "@/components/JsonLd";
import { formatCurrencyBRL, formatBrandName, formatModelName, formatListedAgo, vehicleSeoDescription } from "@/lib/format";
import {
  buildVehiclePublicSpecs,
  STORE_INSPECTION_LABEL,
} from "@/lib/vehicle-specs";
import { vehicleLocationLabel } from "@/lib/vehicle-location";
import { absoluteUrl, breadcrumbJsonLd, vehicleJsonLd } from "@/lib/seo";
import { fichaWhatsAppTracking, site } from "@/lib/site";
import { priceBandHref } from "@/lib/related-vehicles";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import {
  collapseDuplicateAccessories,
  formatUpdatedAt,
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
} from "@/lib/vehicle-display";
import { isRetiredStockSlug } from "@/lib/retired-listings";
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vehicle = await getVehicleByParam(id);
  if (!vehicle) {
    if (isRetiredStockSlug(id)) {
      return {
        title: `Anúncio indisponível | ${site.name}`,
        robots: { index: false, follow: true },
      };
    }
    return { title: `Veículo não encontrado | ${site.name}` };
  }

  const sold = vehicle.status === "vendido";
  const display = formatVehicleDisplay(vehicle);
  const label = display.titleWithYear;
  const title = sold
    ? `${label} (vendido) | ${site.name}`
    : `${label} | ${site.name}`;
  const description = vehicleSeoDescription({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
    price: vehicle.price,
    km: vehicle.km,
    transmission: display.transmission,
    sold,
    siteName: site.name,
  });
  const rawCover = vehicle.photos[0]?.url;
  const cover = rawCover ?? null;
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
      images: cover
        ? [
            {
              url: cover,
              width: 1200,
              height: 630,
              alt: label,
            },
          ]
        : [
            {
              url: absoluteUrl("/og.png"),
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cover ? [cover] : [absoluteUrl("/og.png")],
    },
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await getVehicleByParam(id);
  if (!vehicle) {
    if (isRetiredStockSlug(id)) {
      permanentRedirect("/estoque");
    }
    notFound();
  }

  const canonicalSlug = vehicleSlug(vehicle);
  if (id !== canonicalSlug) {
    permanentRedirect(vehiclePath(vehicle));
  }

  const path = vehiclePath(vehicle);
  const fichaTrack = fichaWhatsAppTracking({ id: vehicle.id, path });
  const sold = vehicle.status === "vendido";
  const isMoto = vehicle.category === "moto";
  const display = formatVehicleDisplay(vehicle);
  const title = display.title;
  const fullLabel = display.fullLabel;
  const galleryAlt = display.titleWithYear;
  const accessories = collapseDuplicateAccessories(vehicle.accessories);
  const whatsapp = {
    interest: formatVehicleWhatsAppMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "interest",
    }),
    video: formatVehicleWhatsAppMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "video",
    }),
    finance: formatVehicleWhatsAppMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "finance",
    }),
    visit: formatVehicleWhatsAppMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "visit",
    }),
    trade: formatVehicleWhatsAppMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "trade",
    }),
    sameBand: formatVehicleWhatsAppMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "similar",
    }),
  };
  const sameBandHref = priceBandHref(vehicle.price);
  const sameBandTitle = isMoto
    ? "Motos na mesma faixa"
    : "Carros na mesma faixa";
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

  const specs = buildVehiclePublicSpecs({
    category: vehicle.category,
    year: vehicle.year,
    yearModel: vehicle.yearModel,
    km: vehicle.km,
    fuel: vehicle.fuel,
    transmission: display.transmission,
    color: display.color,
    engine: vehicle.engine,
    doors: vehicle.doors,
    plateEnd: vehicle.plateEnd,
    warranty: vehicle.warranty,
    inspection: vehicle.inspection,
    locationCity: vehicle.locationCity,
  });

  const hasDetails =
    Boolean(vehicle.description) || accessories.length > 0;
  const listedAgo = formatListedAgo(vehicle.createdAt);

  return (
    <div
      data-ficha-page=""
      className="pb-sticky-bar-safe lg:pb-10"
    >
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
      <VehicleChatContext
        vehicle={{
          id: vehicle.id,
          label: title,
          brand: formatBrandName(vehicle.brand),
          model: formatModelName(vehicle.model),
          version: vehicle.version,
          year: vehicle.yearModel,
          price: vehicle.price,
          path,
          category: vehicle.category,
          sold: sold,
        }}
      />
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
              A página permanece no ar para quem chegou por um link antigo. Veja{" "}
              <Link
                href="#mesma-faixa"
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                {sameBandTitle.toLowerCase()}
              </Link>{" "}
              ou o{" "}
              <Link
                href="/estoque"
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                estoque disponível
              </Link>
              .
            </p>
          </div>
        ) : null}

        <div className="hidden lg:block">
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
        </div>

        {/* Mobile: primeira dobra. Desktop: galeria | ficha. */}
        <div className="lg:mt-5 lg:grid lg:grid-cols-[1.35fr_0.9fr] lg:items-start lg:gap-8">
          <div className="ficha-mobile-fold min-w-0 lg:order-1">
            <div className="ficha-mobile-photo relative min-w-0">
              <div className="absolute left-3 top-3 z-[3] lg:hidden">
                <Suspense fallback={null}>
                  <StockBackLink fallbackHref="/estoque" variant="overlay" />
                </Suspense>
              </div>
              <VehicleGallery photos={vehicle.photos} alt={galleryAlt} />
            </div>
            <div className="shrink-0 lg:hidden">
              <VehicleMobileSummary
                title={title}
                version={display.version}
                price={vehicle.price}
                sold={sold}
                year={vehicle.year}
                yearModel={vehicle.yearModel}
                km={vehicle.km}
                transmission={display.transmission}
                city={vehicleLocationLabel(vehicle.locationCity)}
                soldHref={related.length > 0 ? "#mesma-faixa" : "/estoque"}
                soldLabel={
                  related.length > 0 ? "Ver na mesma faixa" : "Ver estoque disponível"
                }
                whatsapp={{
                  contentId: vehicle.id,
                  contentName: fullLabel,
                  make: formatBrandName(vehicle.brand),
                  model: formatModelName(vehicle.model),
                  message: whatsapp.interest,
                  trackingContent: fichaTrack.content,
                }}
              />
            </div>
          </div>

          <aside className="order-2 hidden lg:sticky lg:top-24 lg:row-span-2 lg:block">
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
                {!sold && vehicle.inspection ? (
                  <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    {STORE_INSPECTION_LABEL}
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
                    className="ml-auto hidden lg:flex"
                  />
                ) : null}
              </div>

              <div>
                <h1 className="font-display text-[1.65rem] font-bold leading-tight tracking-tight text-cream sm:text-2xl sm:text-[1.75rem]">
                  {title}
                </h1>
                {display.version ? (
                  <p className="mt-1 text-sm text-muted">{display.version}</p>
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
              {!sold ? <VehicleTrustNotes /> : null}
              {listedAgo || vehicle.updatedAt ? (
                <p className="text-xs text-muted">
                  {[
                    listedAgo,
                    vehicle.updatedAt ? formatUpdatedAt(vehicle.updatedAt) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {!sold ? (
                <GoogleReviewsBadge
                  reviews={google}
                  className="mt-0 border-white/10"
                />
              ) : null}

              <dl className="ficha-spec-grid grid grid-cols-2 gap-2 border-y border-white/10 py-3.5 text-sm">
                {specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="min-w-0 border border-white/10 bg-asphalt/40 px-3 py-2.5"
                  >
                    <dt className="text-[11px] uppercase tracking-wider text-muted">
                      {spec.label === "Disponível em" ? "Cidade" : spec.label}
                    </dt>
                    {/* Sem truncate: valores longos da ficha precisam aparecer inteiros. */}
                    <dd
                      className={`mt-0.5 font-display text-sm leading-snug [overflow-wrap:anywhere] ${
                        spec.empty
                          ? "font-medium text-muted"
                          : "font-semibold text-cream"
                      }`}
                    >
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {sold ? (
                <Link
                  href={related.length > 0 ? "#mesma-faixa" : "/estoque"}
                  className="inline-flex w-full min-h-[48px] items-center justify-center bg-brand px-5 font-display text-sm font-semibold uppercase tracking-wide text-asphalt transition hover:bg-brand-orange"
                >
                  {related.length > 0 ? "Ver na mesma faixa" : "Ver estoque disponível"}
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
                      trackingLabel="ficha"
                      campaign="ficha"
                      content={fichaTrack.content}
                      message={whatsapp.interest}
                    >
                      Tenho interesse
                    </WhatsAppButton>
                  </VehicleLeadHit>

                  <VehicleQuickActions
                    contentId={vehicle.id}
                    contentPath={path}
                    contentName={fullLabel}
                    value={vehicle.price}
                    make={formatBrandName(vehicle.brand)}
                    model={formatModelName(vehicle.model)}
                    year={vehicle.yearModel}
                    video={whatsapp.video}
                    finance={whatsapp.finance}
                    trade={whatsapp.trade}
                  />

                  <ChatOpenButton
                    source="ficha"
                    prompt={`Tenho dúvida sobre o ${title}`}
                    size="lg"
                    variant="solid"
                    className="w-full"
                  />

                  <p className="text-[11px] leading-relaxed text-muted">
                    Financiamento em até 60x e cartão em até 18x. O consultor
                    calcula a parcela no WhatsApp — o site não publica valor de
                    parcela. Sujeito a análise de crédito e CET.
                  </p>

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
                  : `Valores e disponibilidade sujeitos a alteração. Financiamento em até 60x e cartão em até 18x. Parcela só no WhatsApp, com análise de crédito e CET. Combine pelo WhatsApp ${site.whatsappLabel}.`}
              </p>
            </div>
          </aside>

          {hasDetails ? (
            <section className="order-3 hidden border-t border-white/10 pt-5 lg:col-start-1 lg:block">
              {vehicle.description ? (
                <div>
                  <h2 className="font-display text-base font-semibold text-cream">
                    Sobre o veículo
                  </h2>
                  <VehicleDescription
                    text={vehicle.description}
                    className="mt-2 text-sm sm:text-[15px]"
                  />
                </div>
              ) : null}

              {accessories.length > 0 ? (
                <div className={vehicle.description ? "mt-5" : undefined}>
                  <h2 className="font-display text-base font-semibold text-cream">
                    Itens e acessórios
                  </h2>
                  <ul className="mt-3 columns-1 gap-x-8 text-sm text-cream/90 sm:columns-2">
                    {accessories.map((item) => (
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

        <VehicleMobileBlocks
          fullLabel={fullLabel}
          path={path}
          sold={sold}
          price={vehicle.price}
          yearModel={vehicle.yearModel}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          vehicleId={vehicle.id}
          description={vehicle.description}
          accessories={accessories}
          specs={specs}
          inspection={vehicle.inspection}
          conditions={conditions}
          listedLine={
            [
              listedAgo,
              vehicle.updatedAt ? formatUpdatedAt(vehicle.updatedAt) : "",
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          google={google}
          prompt={`Tenho dúvida sobre o ${title}`}
          quickActions={
            sold
              ? undefined
              : {
                  contentPath: path,
                  video: whatsapp.video,
                  finance: whatsapp.finance,
                  trade: whatsapp.trade,
                }
          }
        />

        {related.length > 0 ? (
          <section
            id="mesma-faixa"
            className="mt-10 scroll-mt-24 border-t border-white/5 pt-8 sm:mt-12 sm:pt-10"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-cream sm:text-xl">
                  {sameBandTitle}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  {sold
                    ? "Este já foi. Estas opções estão no estoque agora — ficha ou WhatsApp."
                    : "Se este não fechar, tem outros na mesma faixa. Abra a ficha ou chame no WhatsApp."}
                </p>
              </div>
              <Link
                href={sameBandHref}
                className="inline-flex min-h-[44px] items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
              >
                Ver a faixa no estoque
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-5">
              <VehicleGrid vehicles={related} whatsappCampaign="ficha" />
            </div>
            <div className="mt-5">
              <WhatsAppButton
                trackingLabel="ficha-mesma-faixa"
                campaign="ficha"
                content={fichaTrack.content}
                message={whatsapp.sameBand}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Pedir outros nesta faixa
              </WhatsAppButton>
            </div>
          </section>
        ) : null}
      </Container>

      <VehicleMobileBar
        vehicleId={vehicle.id}
        vehiclePath={path}
        contentName={fullLabel}
        message={whatsapp.interest}
        videoMessage={whatsapp.video}
        financeMessage={whatsapp.finance}
        tradeMessage={whatsapp.trade}
        brand={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        year={vehicle.yearModel}
        price={vehicle.price}
        sold={sold}
        category={vehicle.category}
        soldHref={related.length > 0 ? "#mesma-faixa" : "/estoque"}
        soldLabel={related.length > 0 ? "Ver na mesma faixa" : "Ver estoque"}
      />
    </div>
  );
}
