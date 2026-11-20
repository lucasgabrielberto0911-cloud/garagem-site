import { publicVehicleDescription } from "@/lib/public-vehicle-description";
import type { Metadata } from "next";
import Link from "next/link";
import { RememberHotLeadVehicle } from "@/components/site/RememberHotLeadVehicle";
import { RememberRecentVehicle } from "@/components/site/RememberRecentVehicle";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { FichaSectionAnchors } from "@/components/site/FichaSectionAnchors";
import { DeferredSimilarVehicles } from "@/components/site/DeferredSimilarVehicles";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import {
  hasMobileFichaSpecs,
  sheetSpecs,
  VehicleMobileBlocks,
} from "@/components/site/VehicleMobileDossier";
import { VehicleConditions } from "@/components/site/VehicleConditions";
import { VehicleVerifiedSection } from "@/components/site/VehicleVerifiedInfo";
import { VehicleAccessoryChips } from "@/components/site/VehicleAccessoryChips";
import { VehicleDescription, visibleDescriptionSegments } from "@/components/site/VehicleDescription";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { StockBackLink } from "@/components/site/StockBackLink";
import { VehicleLeadHit, VehicleViewContent } from "@/lib/funnel-events";
import { Container, WhatsAppButton } from "@/components/site/ui";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { VehicleSeals } from "@/components/site/VehicleSeals";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleChatContext } from "@/components/site/VehicleChatContext";
import { SeoInternalLinks } from "@/components/site/SeoInternalLinks";
import { MissingModelForm } from "@/components/site/MissingModelForm";
import { MissingModelDisclosure } from "@/components/site/MissingModelDisclosure";
import { stockLandingLinks } from "@/lib/stock-landings";
import { JsonLd } from "@/components/JsonLd";
import { buildVehicleFichaMetadata } from "@/lib/vehicle-seo";
import { formatCurrencyBRL, formatBrandName, formatModelName } from "@/lib/format";
import { ListedAgo } from "@/components/site/ListedAgo";
import {
  buildVehiclePublicSpecs,
  formatVehicleYearRange,
  SPEC_EMPTY,
  vehicleColorFact,
  vehicleKeyFacts,
} from "@/lib/vehicle-specs";
import { VehicleKeyFacts } from "@/components/site/VehicleKeyFacts";
import { absoluteUrl, breadcrumbJsonLd, vehicleJsonLd } from "@/lib/seo";
import { fichaWhatsAppTracking, site } from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";
import { priceBandHref } from "@/lib/related-vehicles";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import {
  buildVehicleShortName,
  buildWhatsAppCarMessage,
  collapseDuplicateAccessories,
  collapseWhitespace,
  formatUpdatedAt,
  formatVehicleDisplay,
} from "@/lib/vehicle-display";
import { isRetiredStockSlug } from "@/lib/retired-listings";
import { catalogPixelAutoFields } from "@/lib/catalog-feed";
import { vehiclePath, vehicleSlug } from "@/lib/vehicle-slug";
import { soldFichaNavLinks } from "@/lib/sold-ficha-nav";
import { getVehicleConditions } from "@/lib/site-content";
import { getVehicleVerifiedItems } from "@/lib/vehicle-verified-data";
import { publicVerifiedItems, verifiedHeading } from "@/lib/vehicle-verified";
import { publicDossierChips } from "@/lib/vehicle-dossier";
import { publicVehicleSeals } from "@/lib/vehicle-seals";
import {
  getPublicVehicleStaticParams,
  getVehicleByParam,
} from "@/lib/vehicles";

export const revalidate = 3600;
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

  return buildVehicleFichaMetadata(vehicle);
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await getVehicleByParam(id);
  if (!vehicle) {
    // Só anúncios retirados conhecidos vão ao estoque; id inexistente dá 404.
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
  const description = publicVehicleDescription(vehicle.description, sold);
  const isMoto = vehicle.category === "moto";
  const display = formatVehicleDisplay(vehicle);
  const title = display.title;
  const fullLabel = display.fullLabel;
  const galleryAlt = [display.fullLabel, display.color].filter(Boolean).join(" · ") + " em Linhares/ES";
  const landingLinks = stockLandingLinks([vehicle]);
  const breadcrumbs = [
    { name: "Início", path: "/" },
    { name: "Estoque", path: "/estoque" },
    ...landingLinks.map(link => ({ name: link.label, path: link.path })),
    { name: fullLabel, path },
  ];
  const accessories = collapseDuplicateAccessories(vehicle.accessories);
  const whatsapp = {
    interest: buildWhatsAppCarMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "interest",
      pageOrigin: "ficha",
    }),
    mobileBar: buildWhatsAppCarMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "interest",
      pageOrigin: "barra fixa",
    }),
    video: buildWhatsAppCarMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "video",
      pageOrigin: "ficha",
    }),
    finance: buildWhatsAppCarMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "finance",
      pageOrigin: "ficha",
    }),
    visit: buildWhatsAppCarMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "visit",
      pageOrigin: "ficha",
    }),
    trade: buildWhatsAppCarMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "trade",
      pageOrigin: "ficha",
    }),
    sameBand: buildWhatsAppCarMessage({
      ...vehicle,
      path,
      isMoto,
      intent: "similar",
      pageOrigin: "ficha",
    }),
  };
  const soldNavLinks = soldFichaNavLinks(vehicle);
  const sameBandHref = sold ? "/estoque" : priceBandHref(vehicle.price);
  const sameBandTitle = isMoto
    ? "Motos na mesma faixa"
    : "Carros na mesma faixa";
  const [conditions, verifiedItems, publicSite] = await Promise.all([
    getVehicleConditions(),
    // Falha ou tabela ausente = sem seção; carro vendido não mostra.
    sold ? Promise.resolve([]) : getVehicleVerifiedItems(vehicle.id),
    getPublicSite(),
  ]);
  const verified = publicVerifiedItems(verifiedItems, vehicle.photos, isMoto);
  const seals = sold ? [] : publicVehicleSeals({ verified, accessories });
  const dossierChips = sold ? [] : publicDossierChips(vehicle);

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
  const sheet = sheetSpecs(specs);

  // Cor, ano e KM: quadradinhos do topo (desktop e celular).
  const keyFacts = vehicleKeyFacts(specs);
  const keyColor = vehicleColorFact(specs);
  const yearBadge = formatVehicleYearRange(vehicle.year, vehicle.yearModel);

  const hasAboutText =
    !!description && visibleDescriptionSegments(description, vehicle, specs).length > 0;
  const hasDetails =
    hasAboutText || accessories.length > 0;
  const updatedLabel = vehicle.updatedAt
    ? formatUpdatedAt(vehicle.updatedAt)
    : "";
  // Catálogo Meta: só disponível do estoque próprio (nem vendido, reservado ou consignado).
  const inCatalog = !sold && vehicle.status === "disponivel" && vehicle.catalog === true;
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
      <RememberHotLeadVehicle
        slug={canonicalSlug}
        name={buildVehicleShortName(vehicle)}
        year={vehicle.yearModel}
        link={absoluteUrl(path)}
        sold={sold}
      />
      <VehicleViewContent
        contentId={vehicle.id}
        contentName={fullLabel}
        slug={canonicalSlug}
        value={sold ? undefined : vehicle.price}
        make={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        year={vehicle.yearModel}
        catalog={inCatalog}
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
          status: vehicle.status,
          sold: sold,
          catalog: inCatalog,
        }}
      />
      <JsonLd data={vehicleJsonLd(vehicle)} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <Container size="header">
        {sold ? (
          <div
            role="status"
            className="mb-4 border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 sm:px-5"
          >
            <p className="font-display text-sm font-semibold text-cream sm:text-base">
              Este veículo já foi vendido
            </p>
            <p className="mt-1 text-sm text-cream/80">
              A página permanece no ar para quem chegou por um link antigo. Veja{" "}
              <Link
                href="#mesma-faixa"
                className="font-medium text-brand-light underline-offset-4 hover:underline"
              >
                opções e peça um parecido
              </Link>{" "}
              ou confira o{" "}
              <Link
                href="/estoque"
                prefetch={false}
                className="font-medium text-brand-light underline-offset-4 hover:underline"
              >
                estoque disponível
              </Link>
              .
            </p>
            <nav
              aria-label="Continuar procurando"
              className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-2"
            >
              {soldNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-brand-light underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}

        <div className="hidden lg:block">
          <Suspense fallback={null}>
            <StockBackLink />
          </Suspense>
          <nav
            aria-label="Você está aqui"
            className="text-sm text-cream/80 sm:text-center"
          >
            {breadcrumbs.map((item, index) => (
              <span key={item.path}>
                {index > 0 ? <span className="mx-2" aria-hidden="true">/</span> : null}
                {index === breadcrumbs.length - 1 ? (
                  <span aria-current="page" className="text-cream">{item.name}</span>
                ) : (
                  <Link href={item.path} prefetch={false} className="transition hover:text-cream">
                    {item.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>

        <FichaSectionAnchors hasDetails={hasDetails} />

        {/* Mobile: primeira dobra. Desktop: galeria | ficha. */}
        <div className="lg:mt-5 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-8">
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

            <section
              data-ficha-section="especificacoes"
              className="ficha-jump-target hidden border-t border-white/12 pt-5 lg:mt-6 lg:block"
            >
              {/* Só o que o card ao lado não mostra (motor, portas...). Sem dado novo, fica só o "Anunciado hoje". */}
              {sheet.length > 0 ? (
                <h2 className="font-display text-lg font-bold tracking-tight text-cream">
                  Ficha técnica
                </h2>
              ) : null}
              {vehicle.createdAt || updatedLabel ? (
                <p className={`text-sm text-muted${sheet.length > 0 ? " mt-1" : ""}`}>
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
              {sheet.length > 0 ? (
                <dl
                  data-ficha-spec-grid=""
                  className="mt-3 grid grid-cols-3 gap-2 text-sm [&>:last-child:nth-child(3n+1)]:col-span-3 [&>:last-child:nth-child(3n+2)]:col-span-2"
                >
                  {sheet.map((spec) => (
                    <div
                      key={spec.label}
                      className="min-w-0 border border-white/15 bg-ink px-3 py-2.5"
                    >
                      <dt className="text-sm font-normal text-muted">{spec.label}</dt>
                      {/* Sem truncate: valores longos da ficha precisam aparecer inteiros. */}
                      <dd className="mt-0.5 font-display text-[15px] font-bold leading-snug text-cream [overflow-wrap:break-word]">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>

            {hasDetails ? (
              <section
                data-ficha-section="detalhes"
                className="ficha-jump-target hidden pt-6 lg:block"
              >
                {hasAboutText && description ? (
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-cream">
                      Sobre o veículo
                    </h2>
                    <VehicleDescription
                      text={description}
                      summaryFacts={vehicle}
                      specRows={specs}
                      className="mt-2 text-sm sm:text-[15px]"
                    />
                  </div>
                ) : null}

                {accessories.length > 0 ? (
                  <div
                    id="opcionais-desktop"
                    data-ficha-opcionais=""
                    className={`ficha-jump-target ${hasAboutText ? "mt-8 border-t border-white/12 pt-6" : ""}`}
                  >
                    <h2 className="flex flex-wrap items-baseline gap-x-3 font-display text-xl font-bold tracking-tight text-cream">
                      Itens e acessórios
                      <span className="text-sm font-semibold text-brand-light">
                        {accessories.length === 1 ? "1 opcional" : `${accessories.length} opcionais`}
                      </span>
                    </h2>
                    <VehicleAccessoryChips items={accessories} />
                  </div>
                ) : null}
              </section>
            ) : null}

            {verified.length > 0 ? (
              <VehicleVerifiedSection
                items={verified}
                alt={galleryAlt}
                heading={verifiedHeading(isMoto)}
                sold={sold}
              />
            ) : null}
          </div>

          <aside className="ficha-aside order-2 min-w-0">
            {/* Sem sticky: o card rola junto com a página (um scroll só).
                O resumo do topo (com o único h1 visível) serve celular e desktop. */}
            <div className="pb-3 pt-3 lg:border lg:border-white/20 lg:bg-ink lg:p-5 xl:p-6">
              <div className="ficha-mobile-sheet flex flex-col gap-2.5 lg:gap-4">
              <div className="hidden flex-wrap items-center gap-2 lg:flex">
                <span className="font-display text-sm font-semibold uppercase tracking-wider text-brand-light">
                  {vehicleCategoryLabel(vehicle.category)}
                </span>
                {sold ? (
                  <span className="bg-white/15 px-2 py-0.5 font-display text-sm font-semibold uppercase tracking-wider text-cream">
                    Vendido
                  </span>
                ) : vehicle.status === "reservado" ? (
                  <span className="bg-brand-orange px-2 py-0.5 font-display text-sm font-semibold uppercase tracking-wider text-asphalt">
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
                    catalog={inCatalog}
                    className="ml-auto hidden lg:flex"
                  />
                ) : null}
              </div>
              <div data-ficha-title-block="">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 lg:gap-x-3">
                  <h1 className="break-normal whitespace-normal font-display text-[1.25rem] font-bold leading-snug tracking-tight text-cream lg:text-[1.75rem] lg:leading-tight">
                    {title}
                  </h1>
                  {yearBadge !== SPEC_EMPTY ? (
                    <span className="inline-flex shrink-0 items-center border border-white/25 bg-ink px-2 py-0.5 font-display text-sm font-semibold tabular-nums text-cream whitespace-nowrap lg:bg-asphalt/80 lg:px-2.5">
                      {yearBadge}
                    </span>
                  ) : null}
                </div>
                {vehicle.version?.trim() ? (
                  <p className="mt-1 break-normal whitespace-normal text-sm leading-relaxed text-muted lg:text-[15px] lg:leading-snug">{collapseWhitespace(vehicle.version ?? "")}</p>
                ) : null}
              </div>

              <p
                data-ficha-price=""
                className="-mt-1 font-display text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-brand-light lg:mt-0 lg:text-[2.25rem]"
              >
                {sold ? (
                  <span className="text-base text-cream/80">Já vendido</span>
                ) : (
                  <span className="ficha-price">{formatCurrencyBRL(vehicle.price)}</span>
                )}
              </p>

              <VehicleKeyFacts facts={keyFacts} color={keyColor} onInk="lg" hideYearBelowLg={yearBadge !== SPEC_EMPTY} specAnchor={!hasMobileFichaSpecs(specs)} />

              <VehicleInspectionBadge inspection={sold ? null : vehicle.inspection} />
              {!sold ? (
                <VehicleSeals
                  seals={seals.filter((seal) => seal.id !== "opcionais")}
                  chips={dossierChips}
                />
              ) : null}

              {sold ? (
                <div className="hidden space-y-2 lg:block">
                  <Link
                    href="#mesma-faixa"
                    prefetch={false}
                    className="inline-flex w-full min-h-[48px] items-center justify-center bg-brand px-5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-brand-dark"
                  >
                    Ver opções e pedir parecido
                  </Link>
                  <WhatsAppButton
                    size="md"
                    variant="outline"
                    className="w-full"
                    trackingLabel="ficha-vendido"
                    campaign="ficha"
                    content={fichaTrack.content}
                    vehicleId={vehicle.id}
                    slug={canonicalSlug}
                    pageOrigin="ficha"
                    message={whatsapp.interest}
                  >
                    Pedir parecido no WhatsApp
                  </WhatsAppButton>
                </div>
              ) : (
                <>
                  <div className="hidden lg:block">
                    <VehicleLeadHit
                      contentId={vehicle.id}
                      contentName={fullLabel}
                      value={sold ? undefined : vehicle.price}
                      make={formatBrandName(vehicle.brand)}
                      model={formatModelName(vehicle.model)}
                      year={vehicle.yearModel}
                      {...autoHit}
                      catalog={inCatalog}
                      status={vehicle.status}
                      sold={sold}
                    >
                      <WhatsAppButton
                        size="lg"
                        className="hidden w-full lg:inline-flex lg:text-lg"
                        trackingLabel="ficha"
                        campaign="ficha"
                        content={fichaTrack.content}
                        vehicleId={vehicle.id}
                        slug={canonicalSlug}
                        pageOrigin="ficha"
                        message={whatsapp.interest}
                      >
                        Falar no WhatsApp
                      </WhatsAppButton>
                    </VehicleLeadHit>
                    <p className="mt-2 text-center text-sm leading-relaxed text-muted">
                      Abre o WhatsApp com este anúncio — modelo, ano e preço.
                    </p>
                  </div>

                  {/* Financiamento, troca, vídeo e visita: à vista, em estilo discreto para não competir com o botão principal. */}
                  <div data-ficha-more-actions="" className="hidden border-t border-white/12 pt-3 lg:block">
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
                      catalog={inCatalog}
                      status={vehicle.status}
                      sold={sold}
                      video={whatsapp.video}
                      finance={whatsapp.finance}
                      trade={whatsapp.trade}
                      visit={whatsapp.visit}
                      hasVideo={!!vehicle.hasVideo}
                      variant="secondary"
                      className=""
                    />
                    <p className="mt-2.5 text-sm">
                      <Link
                        href={`/troca?carro=${encodeURIComponent(canonicalSlug)}`}
                        prefetch={false}
                        className="inline-flex items-center text-cream/90 underline decoration-white/35 underline-offset-4 transition hover:text-cream hover:decoration-brand"
                      >
                        Tem carro pra dar na troca?
                      </Link>
                    </p>
                  </div>

                  {/* No celular o CSS sobe este bloco para logo abaixo do preço (sem Linhares/ES). */}
                  <VehicleTrustNotes warranty={vehicle.warranty} />
                </>
              )}

              <div className="hidden flex-wrap items-center gap-x-5 gap-y-1 text-sm lg:flex">
                {/* No computador o botão flutuante do chat some na ficha: este é o acesso. O link de avaliar o usado saiu: "Tenho um usado para trocar" já cobre. */}
                {!sold ? (
                  <ChatOpenButton
                    source="ficha"
                    prompt={`Tenho dúvida sobre o ${title}`}
                    size="compact"
                    variant="ghost"
                    className="-ml-3 !text-sm"
                  />
                ) : null}
                <ShareVehicle
                  title={fullLabel}
                  path={path}
                  vehicleId={vehicle.id}
                  variant="compact"
                />
              </div>

              <p className="hidden text-sm leading-relaxed text-muted lg:block">
                {sold
                  ? "Este anúncio não está mais à venda. Confira outras opções no estoque."
                  : `Valores sujeitos a alteração. Financiamento e cartão com análise de crédito; condições pelo WhatsApp ${site.whatsappLabel}.`}
              </p>
              </div>
            </div>

            {!sold ? (
              <div className="hidden lg:block">
                <VehicleConditions
                  vehicleWarranty={vehicle.warranty}
                  conditions={conditions}
                />
                {/* Fecha a coluna: o botão do card já saiu da tela quando a pessoa chega aqui. */}
                <div data-ficha-second-cta="" className="mt-6 border-t border-white/12 pt-5">
                  <p className="font-display text-lg font-bold tracking-tight text-cream">
                    Ficou com alguma dúvida?
                  </p>
                  <p className="mt-1 text-sm leading-snug text-muted">
                    A loja responde sobre este anúncio pelo WhatsApp.
                  </p>
                  <VehicleLeadHit
                    contentId={vehicle.id}
                    contentName={fullLabel}
                    value={vehicle.price}
                    make={formatBrandName(vehicle.brand)}
                    model={formatModelName(vehicle.model)}
                    year={vehicle.yearModel}
                    {...autoHit}
                    catalog={inCatalog}
                    status={vehicle.status}
                    sold={sold}
                  >
                    <WhatsAppButton
                      size="md"
                      className="mt-3 w-full"
                      trackingLabel="ficha-coluna"
                      campaign="ficha"
                      content={fichaTrack.content}
                      vehicleId={vehicle.id}
                      slug={canonicalSlug}
                      pageOrigin="ficha"
                      message={whatsapp.interest}
                    >
                      Tirar dúvidas no WhatsApp
                    </WhatsAppButton>
                  </VehicleLeadHit>
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        <VehicleMobileBlocks
          hours={publicSite.hours}
          fullLabel={fullLabel}
          path={path}
          sold={sold}
          catalog={inCatalog}
          status={vehicle.status}
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
          verified={verified}
          warranty={vehicle.warranty}
          verifiedHeading={verifiedHeading(isMoto)}
          quickActions={
            sold
              ? undefined
              : {
                  contentPath: path,
                  ...autoHit,
                  video: whatsapp.video,
                  finance: whatsapp.finance,
                  trade: whatsapp.trade,
                  visit: whatsapp.visit,
                  hasVideo: !!vehicle.hasVideo,
                }
          }
        />

        <Suspense
          fallback={
            <div id="mesma-faixa" className="mt-10 min-h-64" aria-busy="true">
              <p className="text-cream/80">Buscando veículos parecidos...</p>
            </div>
          }
        >
          <DeferredSimilarVehicles
            query={[vehicle.id, vehicle.brand, 3, vehicle.category, vehicle.price, display.transmission]}
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
        </Suspense>

        {/* O formulário também serve a /pedido: o mínimo de 14px vale só na ficha. */}
        <div className="[&_.text-xs]:text-sm">
          <MissingModelDisclosure>
            <MissingModelForm
              idPrefix="ficha"
              sourcePage="ficha"
              contextLabel={fullLabel}
              pagePath={path}
              interestVehicleId={vehicle.id}
              initialModel={sold ? title : ""}
              description={
                sold
                  ? `O ${title} já foi. Se você procura outro, deixa o modelo aqui.`
                  : `Se o ${title} não é o que você procura, deixa o modelo aqui.`
              }
            />
          </MissingModelDisclosure>
        </div>
        <SeoInternalLinks />
      </Container>

      <VehicleMobileBar
        vehicleId={vehicle.id}
        vehicleSlug={canonicalSlug}
        vehiclePath={path}
        contentName={fullLabel}
        message={whatsapp.mobileBar}
        brand={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        version={vehicle.version}
        status={vehicle.status}
        year={vehicle.yearModel}
        price={sold ? 0 : vehicle.price}
        stateOfVehicle={autoHit.stateOfVehicle}
        exteriorColor={autoHit.exteriorColor}
        catalogTransmission={autoHit.transmission}
        bodyStyle={autoHit.bodyStyle}
        fuelType={autoHit.fuelType}
        postalCode={autoHit.postalCode}
        catalog={inCatalog}
        sold={sold}
        category={vehicle.category}
        soldHref="#mesma-faixa"
        soldLabel="Ver opções"
      />
    </div>
  );
}
