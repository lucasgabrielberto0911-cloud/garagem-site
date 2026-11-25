import Link from "next/link";
import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import { isValidLqipDataUri } from "@/lib/photo-lqip-cache";
import {
  AWAITING_DELIVERY_LABEL,
  isAwaitingDeliveryStatus,
  isSoldOrAwaitingDelivery,
} from "@/lib/public-stock";
import { vehicleModelLandingPath } from "@/lib/stock-landings";
import { isNewListing } from "@/lib/vehicle-badges";
import { formatBrandName, formatCurrencyBRL, formatModelName } from "@/lib/format";
import { publicCardFacts, type PublicCardFact } from "@/lib/public-card-facts";
import {
  CARD_SIZES,
  coverSrc,
  coverSrcSet,
  coverMobileSrcSet,
  type VehicleCardRecord,
} from "@/lib/stock-query";
import { formatVehicleDisplay } from "@/lib/vehicle-display";
import { whatsappCampaignFromPath, type WhatsAppCampaign } from "@/lib/site";
import {
  buildWhatsAppCarMessage,
  type WhatsAppCarPageOrigin,
} from "@/lib/whatsapp-car-message";

export type VehicleCardData = VehicleCardRecord;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "listing-card-badge--muted" },
  aguardando_entrega: {
    label: AWAITING_DELIVERY_LABEL,
    className: "listing-card-badge--awaiting",
  },
  vendido: { label: "Vendido", className: "listing-card-badge--muted" },
};

function cardWhatsAppMeta(
  pageOrigin: WhatsAppCarPageOrigin,
  returnTo?: string,
): {
  campaign: WhatsAppCampaign;
  trackingLabel: string;
} {
  if (pageOrigin === "home") {
    return { campaign: "home", trackingLabel: "home-card" };
  }
  if (pageOrigin === "favoritos") {
    return { campaign: "favoritos", trackingLabel: "favoritos-card" };
  }
  if (returnTo && returnTo !== "/estoque" && !returnTo.startsWith("/estoque?")) {
    return {
      campaign: whatsappCampaignFromPath(returnTo),
      trackingLabel: "vehicle-card",
    };
  }
  return { campaign: "estoque", trackingLabel: "vehicle-card" };
}

/** Um único anúncio para estoque, home, favoritos e veículos parecidos. */
export function VehicleCard({
  vehicle,
  priority = false,
  eager = false,
  preloadImage,
  decoding,
  returnTo,
  showDestaque = false,
  hideInterest = false,
  pageOrigin = "card do estoque",
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
  eager?: boolean;
  preloadImage?: boolean;
  decoding?: "sync" | "async" | "auto";
  returnTo?: string;
  showDestaque?: boolean;
  /** Ficha: o card só abre o anúncio, sem a faixa "Tenho interesse". */
  hideInterest?: boolean;
  /** Origem da página incluída na mensagem do WhatsApp e no tracking. */
  pageOrigin?: WhatsAppCarPageOrigin;
  /** Compatibilidade com chamadas antigas: a foto agora é 4:3 em todas as listas. */
  largePhoto?: boolean;
}) {
  const display = formatVehicleDisplay(vehicle);
  const card = publicCardFacts(vehicle);
  const cover = coverSrc(vehicle.photos);
  const rawLqip = vehicle.photos?.[0]?.lqip;
  const lqip = isValidLqipDataUri(rawLqip) ? rawLqip : null;
  const badge = STATUS_BADGE[vehicle.status];
  const awaitingDelivery = isAwaitingDeliveryStatus(vehicle.status);
  const soldOrAwaiting = isSoldOrAwaitingDelivery(vehicle.status);
  const modelPath = vehicleModelLandingPath(vehicle) ?? "/estoque";
  const facts = new Map(card.facts.map((fact) => [fact.label, fact]));
  const version = card.version;
  const favoriteSnapshot = {
    id: vehicle.id,
    category: vehicle.category,
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    yearModel: vehicle.yearModel,
    km: vehicle.km,
    price: vehicle.price,
    transmission: vehicle.transmission,
    fuel: vehicle.fuel,
    status: vehicle.status,
    featured: vehicle.featured,
    color: vehicle.color,
    catalog: vehicle.catalog === true,
    updatedAt:
      vehicle.updatedAt instanceof Date
        ? vehicle.updatedAt.toISOString()
        : vehicle.updatedAt ?? null,
    photos: vehicle.photos.slice(0, 1).map(({ url, thumbnailUrl }) => ({ url, thumbnailUrl })),
  };
  return (
    <article className="vehicle-card listing-card card-lift group">
      <StockVehicleLink
        href={display.path}
        returnTo={returnTo}
        className="listing-card-main"
      >
        <div className="listing-card-photo relative aspect-[4/3] overflow-hidden" data-vehicle-photo="">
          {lqip ? (
            <div
              aria-hidden="true"
              data-photo-lqip=""
              className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-md"
              style={{ backgroundImage: `url("${lqip}")` }}
            />
          ) : null}
          <VehicleImage
            src={cover}
            srcSet={coverSrcSet(vehicle.photos)}
            mobileSrcSet={coverMobileSrcSet(vehicle.photos)}
            alt=""
            fill
            width={480}
            height={360}
            sizes={CARD_SIZES}
            priority={priority}
            eager={eager}
            preloadImage={preloadImage}
            decoding={decoding}
            fadeIn
            className="object-cover"
          />
        </div>
        <div className="listing-card-name" data-vehicle-body="">
          <div className="listing-card-brand-row">
            <p className="listing-card-brand">{formatBrandName(vehicle.brand)}</p>
            <div className="listing-card-badges">
              {badge ? <span className={badge.className}>{badge.label}</span> : null}
              {!badge && isNewListing(vehicle.createdAt) ? (
                <span className="listing-card-badge--new" title="Novo nesta semana">
                  Novo<span className="sr-only"> nesta semana</span>
                </span>
              ) : null}
              {!badge && vehicle.priceDrop ? (
                <span
                  className="listing-card-badge--drop"
                  title={`Baixou ${formatCurrencyBRL(vehicle.priceDrop)}`}
                >
                  Baixou
                  <span className="sr-only"> {formatCurrencyBRL(vehicle.priceDrop)}</span>
                  <span aria-hidden="true" className="hidden sm:max-lg:inline xl:inline"> {formatCurrencyBRL(vehicle.priceDrop)}</span>
                </span>
              ) : null}
              {!cover ? <span className="listing-card-badge--muted">Sem foto</span> : null}
              {showDestaque && !badge ? (
                <span className="listing-card-badge--new">Destaque</span>
              ) : null}
            </div>
          </div>
          <h2 className="listing-card-title font-display">{formatModelName(vehicle.model)}</h2>
        </div>
        <div className="listing-card-version">
          {version ? <p>{version}</p> : null}
        </div>
        <div className="listing-card-year-km">
          <Fact fact={facts.get("Ano")} />
          <Fact fact={facts.get("Km")} />
        </div>
        <div className="listing-card-transmission">
          <Fact fact={facts.get("Câmbio")} />
        </div>
        <div className="listing-card-price-row">
          {card.priceLabel ? <p className="listing-card-price font-display text-brand-light">{card.priceLabel}</p> : null}
        </div>
      </StockVehicleLink>
      <div className="vehicle-card-favorite vehicle-card-favorite--label">
        <FavoriteButton
          vehicleId={vehicle.id}
          label={display.titleWithYear}
          value={soldOrAwaiting ? undefined : vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
          snapshot={favoriteSnapshot}
          catalog={vehicle.status === "disponivel" && vehicle.catalog === true}
          appearance="ghost"
          size="sm"
          showLabel
        />
      </div>
      {hideInterest ? null : (
      <div className="listing-card-interest">
        {awaitingDelivery ? (
          <Link
            href={modelPath}
            prefetch={false}
            className="listing-card-similar-link inline-flex min-h-[44px] w-full items-center justify-center border-t border-white/10 px-2 font-display text-[13px] font-medium text-cream/85 transition touch-manipulation hover:bg-white/[0.04] hover:text-cream"
          >
            Quero um parecido
          </Link>
        ) : vehicle.status !== "vendido" ? (
          <VehicleCardWhatsApp
            showOnStockList
            vehicleId={vehicle.id}
            catalog={vehicle.status === "disponivel" && vehicle.catalog === true}
            label={display.fullLabel}
            message={buildWhatsAppCarMessage({
              ...vehicle,
              path: display.path,
              isMoto: vehicle.category === "moto",
              pageOrigin,
            })}
            value={vehicle.price}
            make={formatBrandName(vehicle.brand)}
            model={formatModelName(vehicle.model)}
            version={vehicle.version}
            status={vehicle.status}
            year={vehicle.yearModel}
            path={display.path}
            pageOrigin={pageOrigin}
            {...cardWhatsAppMeta(pageOrigin, returnTo)}
          />
        ) : null}
      </div>
      )}
    </article>
  );
}

function Fact({ fact }: { fact?: PublicCardFact }) {
  if (!fact) return null;
  return (
    <dl className="listing-card-fact">
      <dt className="sr-only">{fact.label}</dt>
      <dd>{fact.value}</dd>
    </dl>
  );
}
