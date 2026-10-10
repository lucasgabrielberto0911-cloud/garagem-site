import { publicVehicleDescription } from "@/lib/public-vehicle-description";
import type { Metadata } from "next";
import { publicPhotoSrc, publicPhotoSrcSet } from "@/lib/public-photo-url";
import Link from "next/link";
import { RememberRecentVehicle } from "@/components/site/RememberRecentVehicle";
import { preload } from "react-dom";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { FichaSectionNav } from "@/components/site/FichaSectionNav";
import { SimilarVehicles } from "@/components/site/SimilarVehicles";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import {
  hasMobileFichaSpecs,
  VehicleMobileBlocks,
  VehicleMobileSummary,
} from "@/components/site/VehicleMobileDossier";
import { VehicleConditions } from "@/components/site/VehicleConditions";
import { VehicleDescription } from "@/components/site/VehicleDescription";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { StockBackLink } from "@/components/site/StockBackLink";
import { VehicleLeadHit, VehicleViewContent } from "@/components/site/VehiclePixel";
import { Container, WhatsAppButton } from "@/components/site/ui";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { GoogleReviewsBadge } from "@/components/site/GoogleReviewsBadge";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleChatContext } from "@/components/site/VehicleChatContext";
import { MissingModelForm } from "@/components/site/MissingModelForm";
import { JsonLd } from "@/components/JsonLd";
import { VEHICLE_SEO_LOCATION, vehicleSeoTitle } from "@/lib/vehicle-seo";
import { formatCurrencyBRL, formatBrandName, formatModelName, vehicleSeoDescription } from "@/lib/format";
import { ListedAgo } from "@/components/site/ListedAgo";
import { buildVehiclePublicSpecs } from "@/lib/vehicle-specs";
import { absoluteUrl, breadcrumbJsonLd, vehicleJsonLd } from "@/lib/seo";
import { fichaWhatsAppTracking, site } from "@/lib/site";
import { priceBandHref } from "@/lib/related-vehicles";
import {
  GALLERY_HERO_SIZES,
  galleryPreviewSrc,
  galleryPreviewSrcSet,
} from "@/lib/stock-query";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import {
  collapseDuplicateAccessories,
  collapseWhitespace,
  formatUpdatedAt,
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
} from "@/lib/vehicle-display";
import { isRetiredStockSlug } from "@/lib/retired-listings";
import { catalogPixelAutoFields } from "@/lib/catalog-feed";
import { vehiclePath, vehicleSlug } from "@/lib/vehicle-slug";
import { getVehicleConditions, getGoogleReviews } from "@/lib/site-content";
import {
  getPublicVehicleStaticParams,
  getRelatedVehicles,
  getVehicleByParam,
} from "@/lib/vehicles";

export const revalidate = 600;
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
  const title = vehicleSeoTitle({
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    yearModel: vehicle.yearModel,
    sold,
    siteName: site.name,
  });
  const description = vehicleSeoDescription({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
    price: vehicle.price,
    km: vehicle.km,
    transmission: display.transmission,
    sold,
    siteName: site.name,
    location: VEHICLE_SEO_LOCATION,
  });
  const rawCover = vehicle.photos[0]?.url;
  const cover = rawCover ? absoluteUrl(publicPhotoSrc(rawCover)) : null;
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
  const hero = vehicle.photos[0];
  const heroSrc = hero ? publicPhotoSrc(galleryPreviewSrc(hero)) : "";
  const heroSet = hero ? publicPhotoSrcSet(galleryPreviewSrcSet(hero)) : undefined;
  if (heroSrc) {
    preload(heroSrc, {
      as: "image",
      fetchPriority: "high",
      imageSrcSet: heroSet,
      imageSizes: heroSet ? GALLERY_HERO_SIZES : undefined,
    });
  }
  const fichaTrack = fichaWhatsAppTracking({ id: vehicle.id, path });
  const sold = vehicle.status === "vendido";
  const description = publicVehicleDescription(vehicle.description, sold);
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
      display.transmission,
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
  });

  const hasDetails =
    Boolean(description) || accessories.length > 0;
  const updatedLabel = vehicle.updatedAt
    ? formatUpdatedAt(vehicle.updatedAt)
    : "";
  const auto = catalogPixelAutoFields(vehicle);
  const autoHit = {
    stateOfVehicle: auto.state_of_vehicle,
    exteriorColor: auto.exterior_color,
    transmission: auto.transmission,
    bodyStyle: auto.body_style,
    fuelType: auto.fuel_type,
    postalCode: auto.postal_code,
  };

  return (
    <div
      data-ficha-page=""
      className="pb-sticky-bar-safe lg:pb-10"
    >
      {!sold ? <RememberRecentVehicle id={vehicle.id} /> : null}
      <VehicleViewContent
        contentId={vehicle.id}
        contentName={fullLabel}
        slug={canonicalSlug}
        value={sold ? undefined : vehicle.price}
        make={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        year={vehicle.yearModel}
        catalog={!sold}
        {...autoHit}
      />
      <VehicleChatContext
        vehicle={{
          id: vehicle.id,
          label: title,
          brand: formatBrandName(vehicle.brand),
          model: formatModelName(vehicle.model),
          version: vehicle.version,
          year: vehicle.yearModel,
          price: sold ? undefined : vehicle.price,
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
                prefetch={false}
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
            <Link href="/" prefetch={false} className="transition hover:text-cream">
              Início
            </Link>
            <span className="mx-2">/</span>
            <Link href="/estoque" prefetch={false} className="transition hover:text-cream">
              Estoque
            </Link>
            <span className="mx-2">/</span>
            <span className="text-cream">{title}</span>
          </nav>
        </div>

        <FichaSectionNav hasDetails={hasDetails} />

        {/* Mobile: primeira dobra. Desktop: galeria | ficha. */}
        <div className="lg:mt-5 lg:grid lg:grid-cols-[1.35fr_0.9fr] lg:items-start lg:gap-8">
          <div className="ficha-mobile-fold min-w-0 lg:order-1">
            <div
              id="fotos"
              data-ficha-section="fotos"
              className="ficha-jump-target ficha-mobile-photo relative min-w-0"
            >
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
                version={collapseWhitespace(vehicle.version ?? "")}
                price={sold ? 0 : vehicle.price}
                sold={sold}
                year={vehicle.year}
                yearModel={vehicle.yearModel}
                km={vehicle.km}
                transmission={display.transmission}
                plateEnd={vehicle.plateEnd}
                inspection={sold ? null : vehicle.inspection}
                specAnchor={!hasMobileFichaSpecs(specs)}
              />
            </div>

            {hasDetails ? (
              <section
                data-ficha-section="detalhes"
                className="ficha-jump-target hidden border-t border-white/10 pt-5 lg:mt-6 lg:block"
              >
                {description ? (
                  <div>
                    <h2 className="font-display text-base font-semibold text-cream">
                      Sobre o veículo
                    </h2>
                    <VehicleDescription
                      text={description}
                      summaryFacts={vehicle}
                      className="mt-2 text-sm sm:text-[15px]"
                    />
                  </div>
                ) : null}

                {accessories.length > 0 ? (
                  <div className={description ? "mt-5" : undefined}>
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

          <aside className="ficha-aside order-2 hidden lg:sticky lg:z-20 lg:block">
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
                    value={sold ? undefined : vehicle.price}
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
                {vehicle.version?.trim() ? (
                  <p className="mt-1 text-sm text-muted">{collapseWhitespace(vehicle.version ?? "")}</p>
                ) : null}
              </div>

              <p className="font-display text-3xl font-bold leading-none text-cream">
                {sold ? (
                  <span className="text-base text-muted">Já vendido</span>
                ) : (
                  formatCurrencyBRL(vehicle.price)
                )}
              </p>
              {!sold ? (
                <VehicleInspectionBadge inspection={vehicle.inspection} />
              ) : null}
              {!sold ? <VehicleTrustNotes /> : null}

              {sold ? (
                <Link
                  href={related.length > 0 ? "#mesma-faixa" : "/estoque"}
                  prefetch={false}
                  className="inline-flex w-full min-h-[48px] items-center justify-center bg-brand px-5 font-display text-sm font-semibold uppercase tracking-wide text-asphalt transition hover:bg-brand-orange"
                >
                  {related.length > 0 ? "Ver na mesma faixa" : "Ver estoque disponível"}
                </Link>
              ) : (
                <>
                  <VehicleLeadHit
                    contentId={vehicle.id}
                    contentName={fullLabel}
                    value={sold ? undefined : vehicle.price}
                    make={formatBrandName(vehicle.brand)}
                    model={formatModelName(vehicle.model)}
                    year={vehicle.yearModel}
                    {...autoHit}
                  >
                    <WhatsAppButton
                      size="lg"
                      className="hidden w-full lg:inline-flex"
                      trackingLabel="ficha"
                      campaign="ficha"
                      content={fichaTrack.content}
                      vehicleId={vehicle.id}
                      slug={canonicalSlug}
                      message={whatsapp.interest}
                    >
                      Tenho interesse
                    </WhatsAppButton>
                  </VehicleLeadHit>
                  <p className="text-[11px] leading-relaxed text-muted">
                    Abre o WhatsApp com este anúncio — modelo, ano e preço.
                  </p>

                  <VehicleQuickActions
                    contentId={vehicle.id}
                    contentSlug={canonicalSlug}
                    contentPath={path}
                    contentName={fullLabel}
                    value={sold ? 0 : vehicle.price}
                    make={formatBrandName(vehicle.brand)}
                    model={formatModelName(vehicle.model)}
                    year={vehicle.yearModel}
                    {...autoHit}
                    video={whatsapp.video}
                    finance={whatsapp.finance}
                    trade={whatsapp.trade}
                  />
                  <p className="-mt-2 text-[11px] leading-relaxed text-muted">
                    Simular, troca e vídeo também abrem o WhatsApp deste veículo.
                  </p>

                  <ChatOpenButton
                    source="ficha"
                    prompt={`Tenho dúvida sobre o ${title}`}
                    size="md"
                    variant="outline"
                    className="w-full"
                  />
                  <p className="text-[11px] leading-relaxed text-muted">
                    Dúvida breve no site. Preço, visita e proposta seguem no WhatsApp.
                  </p>
                </>
              )}

              <dl
                data-ficha-section="especificacoes"
                className="ficha-jump-target ficha-spec-grid grid grid-cols-2 gap-2 border-y border-white/10 py-3.5 text-sm"
              >
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

              {vehicle.createdAt || updatedLabel ? (
                <p className="text-xs text-muted">
                  <ListedAgo
                    listedAt={
                      vehicle.createdAt
                        ? new Date(vehicle.createdAt).toISOString()
                        : null
                    }
                    updatedLabel={updatedLabel}
                  />
                </p>
              ) : null}
              {!sold ? (
                <GoogleReviewsBadge
                  reviews={google}
                  className="mt-0 border-white/10"
                />
              ) : null}

              {!sold ? (
                <>
                  <p className="text-[11px] leading-relaxed text-muted">
                    Financiamento em até 60x e cartão em até 18x. O consultor
                    calcula a parcela no WhatsApp — o site não publica valor de
                    parcela. Sujeito a análise de crédito e CET.
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                    <Link
                      href={`/vender?interesse=${vehicle.id}&label=${encodeURIComponent(fullLabel)}`}
                      prefetch={false}
                      className="min-h-[44px] inline-flex items-center text-muted underline-offset-4 transition hover:text-cream hover:underline"
                    >
                      Ou preencha a avaliação do seu usado
                    </Link>
                  </div>
                </>
              ) : null}

              {!sold ? (
                <VehicleConditions
                  vehicleWarranty={vehicle.warranty}
                  conditions={conditions}
                />
              ) : null}

              <ShareVehicle
                title={fullLabel}
                path={path}
                vehicleId={vehicle.id}
                className="border-t border-white/10 pt-3"
              />

              <p className="text-xs leading-relaxed text-muted">
                {sold
                  ? "Este anúncio não está mais à venda. Confira outras opções no estoque."
                  : `Valores e disponibilidade sujeitos a alteração. Financiamento em até 60x e cartão em até 18x. Parcela só no WhatsApp, com análise de crédito e CET. Combine pelo WhatsApp ${site.whatsappLabel}.`}
              </p>
            </div>
          </aside>
        </div>

        <VehicleMobileBlocks
          fullLabel={fullLabel}
          path={path}
          sold={sold}
          price={sold ? 0 : vehicle.price}
          yearModel={vehicle.yearModel}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          vehicleId={vehicle.id}
          description={description}
          summaryFacts={vehicle}
          accessories={accessories}
          specs={specs}
          inspection={vehicle.inspection}
          conditions={conditions}
          listedLine={
            <ListedAgo
              listedAt={
                vehicle.createdAt
                  ? new Date(vehicle.createdAt).toISOString()
                  : null
              }
              updatedLabel={updatedLabel}
            />
          }
          google={google}
          prompt={`Tenho dúvida sobre o ${title}`}
          quickActions={
            sold
              ? undefined
              : {
                  contentPath: path,
                  ...autoHit,
                  video: whatsapp.video,
                  finance: whatsapp.finance,
                  trade: whatsapp.trade,
                }
          }
        />

        <div className="mt-10 sm:mt-12">
          <MissingModelForm
            idPrefix="ficha"
            sourcePage="ficha"
            contextLabel={fullLabel}
            pagePath={path}
            interestVehicleId={vehicle.id}
            description={
              sold
                ? `O ${title} já foi. Se você procura outro, deixa o modelo aqui.`
                : `Se o ${title} não é o que você procura, deixa o modelo aqui.`
            }
          />
        </div>

        <SimilarVehicles
          vehicles={related}
          title={sameBandTitle}
          description={
            sold
              ? "Este já foi. Estas opções estão no estoque agora — abra a ficha."
              : "Se este não fechar, estes estão na mesma faixa. Abra a ficha."
          }
          stockHref={sameBandHref}
          whatsapp={{
            message: whatsapp.sameBand,
            trackingLabel: "ficha-mesma-faixa",
            content: fichaTrack.content,
            vehicleId: vehicle.id,
            slug: canonicalSlug,
          }}
        />
      </Container>

      <VehicleMobileBar
        vehicleId={vehicle.id}
        vehicleSlug={canonicalSlug}
        vehiclePath={path}
        contentName={fullLabel}
        message={whatsapp.interest}
        videoMessage={whatsapp.video}
        financeMessage={whatsapp.finance}
        tradeMessage={whatsapp.trade}
        brand={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        year={vehicle.yearModel}
        price={sold ? 0 : vehicle.price}
        stateOfVehicle={autoHit.stateOfVehicle}
        exteriorColor={autoHit.exteriorColor}
        catalogTransmission={autoHit.transmission}
        bodyStyle={autoHit.bodyStyle}
        fuelType={autoHit.fuelType}
        postalCode={autoHit.postalCode}
        sold={sold}
        category={vehicle.category}
        soldHref={related.length > 0 ? "#mesma-faixa" : "/estoque"}
        soldLabel={related.length > 0 ? "Ver na mesma faixa" : "Ver estoque"}
      />
    </div>
  );
}
