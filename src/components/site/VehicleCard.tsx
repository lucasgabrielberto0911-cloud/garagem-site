import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import { Chip } from "@/components/ui/Chip";
import { isNewListing } from "@/lib/vehicle-badges";
import { formatBrandName, formatCurrencyBRL, formatModelName } from "@/lib/format";
import { publicCardFacts, type PublicCardFact } from "@/lib/public-card-facts";
import { getVehicleDisplacementChip, getVehicleYearChip } from "@/lib/vehicle-chips";
import {
  CARD_SIZES,
  coverSrc,
  coverSrcSet,
  coverMobileSrcSet,
  type VehicleCardRecord,
} from "@/lib/stock-query";
import {
  collapseWhitespace,
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
} from "@/lib/vehicle-display";

export type VehicleCardData = VehicleCardRecord;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

/** Um único anúncio para estoque, home, favoritos e veículos parecidos. */
export function VehicleCard({
  vehicle,
  priority = false,
  eager = false,
  returnTo,
  showDestaque = false,
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
  eager?: boolean;
  returnTo?: string;
  showDestaque?: boolean;
  /** Compatibilidade com chamadas antigas: a foto agora é 4:3 em todas as listas. */
  largePhoto?: boolean;
}) {
  const display = formatVehicleDisplay(vehicle);
  const card = publicCardFacts(vehicle);
  const cover = coverSrc(vehicle.photos);
  const badge = STATUS_BADGE[vehicle.status];
  const facts = new Map(card.facts.map((fact) => [fact.label, fact]));
  const version = collapseWhitespace(vehicle.version ?? "");
  const yearChip = getVehicleYearChip(vehicle);
  const displacementChip = getVehicleDisplacementChip(vehicle);
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
        <div className="listing-card-photo relative aspect-[4/3] overflow-hidden bg-asphalt" data-vehicle-photo="">
          <VehicleImage
            src={cover}
            srcSet={coverSrcSet(vehicle.photos)}
            mobileSrcSet={coverMobileSrcSet(vehicle.photos)}
            alt={display.titleWithYear}
            fill
            width={480}
            height={360}
            sizes={CARD_SIZES}
            priority={priority}
            eager={eager}
            className="object-cover"
          />
          <div className="listing-card-shade" aria-hidden="true" />
          <div className="listing-card-badges">
            {badge ? <span className={badge.className}>{badge.label}</span> : null}
            {!badge && isNewListing(vehicle.createdAt) ? (
              <span className="bg-cream text-asphalt">Novo esta semana</span>
            ) : null}
            {!badge && vehicle.priceDrop ? (
              <span className="bg-brand text-cream">
                Baixou {formatCurrencyBRL(vehicle.priceDrop)}
              </span>
            ) : null}
            {!cover ? <span className="bg-white/15 text-cream">Sem foto</span> : null}
            {showDestaque ? <span className="bg-brand text-cream">Destaque</span> : null}
          </div>
        </div>
        <div className="listing-card-name" data-vehicle-body="">
          <p className="listing-card-brand">{formatBrandName(vehicle.brand)}</p>
          <h2 className="listing-card-title font-display">{formatModelName(vehicle.model)}</h2>
        </div>
        <div className="listing-card-version">
          {version ? <p>{version}</p> : null}
        </div>
        {(yearChip || displacementChip) ? (
          <div className="listing-card-chips flex flex-wrap items-center gap-1.5 px-2.5 sm:px-4 my-1.5" data-testid="vehicle-chips">
            {yearChip ? (
              <Chip variant="default" size="xs" data-spec-chip="year">
                {yearChip}
              </Chip>
            ) : null}
            {displacementChip ? (
              <Chip variant="muted" size="xs" data-spec-chip="displacement">
                {displacementChip}
              </Chip>
            ) : null}
          </div>
        ) : null}
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
      <div className="vehicle-card-favorite">
        <FavoriteButton
          vehicleId={vehicle.id}
          label={display.titleWithYear}
          value={vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
          snapshot={favoriteSnapshot}
          appearance="ghost"
          size="sm"
        />
      </div>
      <div className="listing-card-interest">
        {vehicle.status !== "vendido" ? (
          <VehicleCardWhatsApp
            showOnStockList
            vehicleId={vehicle.id}
            label={display.fullLabel}
            message={formatVehicleWhatsAppMessage({
              ...vehicle,
              path: display.path,
              isMoto: vehicle.category === "moto",
            })}
            value={vehicle.price}
            make={formatBrandName(vehicle.brand)}
            model={formatModelName(vehicle.model)}
            year={vehicle.yearModel}
            path={display.path}
          />
        ) : null}
      </div>
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
