import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { RememberVehicleSnapshot } from "@/components/site/RememberVehicleSnapshot";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import { formatBrandName, formatModelName } from "@/lib/format";
import { publicCardFacts, type PublicCardFact } from "@/lib/public-card-facts";
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
  returnTo,
  showDestaque = false,
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
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
  const ariaLabel = card.priceLabel
    ? `${display.titleWithYear} — ${card.priceLabel}`
    : display.titleWithYear;

  return (
    <article className="vehicle-card listing-card card-lift group">
      <RememberVehicleSnapshot
        vehicle={{
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
          locationCity: vehicle.locationCity ?? null,
          updatedAt:
            vehicle.updatedAt instanceof Date
              ? vehicle.updatedAt.toISOString()
              : vehicle.updatedAt ?? null,
          photos: vehicle.photos,
        }}
      />
      <StockVehicleLink
        href={display.path}
        returnTo={returnTo}
        ariaLabel={ariaLabel}
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
            className="object-cover"
          />
          <div className="listing-card-shade" aria-hidden="true" />
          <div className="listing-card-badges">
            {badge ? <span className={badge.className}>{badge.label}</span> : null}
            {!cover ? <span className="bg-white/15 text-cream">Sem foto</span> : null}
            {showDestaque ? <span className="bg-brand text-cream">Destaque</span> : null}
          </div>
        </div>
        <div className="listing-card-name" data-vehicle-body="">
          <p className="listing-card-brand">{formatBrandName(vehicle.brand)}</p>
          <h3 className="listing-card-title font-display">{formatModelName(vehicle.model)}</h3>
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
        <div className="listing-card-city">
          <Fact fact={facts.get("Cidade")} />
        </div>
        <div className="listing-card-price-row">
          {card.priceLabel ? <p className="listing-card-price font-display text-brand">{card.priceLabel}</p> : null}
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
