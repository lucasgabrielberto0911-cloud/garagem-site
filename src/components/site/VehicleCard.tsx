import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { RememberVehicleSnapshot } from "@/components/site/RememberVehicleSnapshot";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { formatBrandName, formatModelName } from "@/lib/format";
import { publicCardFacts, type PublicCardFact } from "@/lib/public-card-facts";
import {
  CARD_SIZES,
  coverSrc,
  coverSrcSet,
  type VehicleCardRecord,
} from "@/lib/stock-query";
import { formatVehicleDisplay } from "@/lib/vehicle-display";

export type VehicleCardData = VehicleCardRecord;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

/**
 * Card de servidor: só o favorito e o link hidratam no cliente.
 * O mesmo card entra na home, no estoque, nos favoritos e na faixa da ficha.
 * Sem atalho de WhatsApp — a conversa fica na ficha e no chat.
 */
export function VehicleCard({
  vehicle,
  priority = false,
  returnTo,
  showDestaque = false,
  largePhoto = false,
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
  returnTo?: string;
  showDestaque?: boolean;
  /** Foto 4:3 no celular — o maior retângulo nas duas colunas do estoque. */
  largePhoto?: boolean;
}) {
  const display = formatVehicleDisplay(vehicle);
  const card = publicCardFacts(vehicle);
  const cover = coverSrc(vehicle.photos);
  const coverSet = coverSrcSet(vehicle.photos);
  const badge = STATUS_BADGE[vehicle.status];
  const href = display.path;
  const ariaLabel = card.priceLabel
    ? `${display.titleWithYear} — ${card.priceLabel}`
    : display.titleWithYear;

  const photoClass = largePhoto
    ? "relative aspect-[4/3] overflow-hidden bg-asphalt sm:aspect-[16/10]"
    : "relative aspect-[16/10] overflow-hidden bg-asphalt";

  return (
    <article
      className={`vehicle-card card-lift group relative flex h-full flex-col overflow-hidden border border-white/10 bg-ink touch-manipulation focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand ${
        largePhoto ? "vehicle-card-stock" : ""
      }`}
    >
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
        href={href}
        returnTo={returnTo}
        ariaLabel={ariaLabel}
        className="absolute inset-0 z-10"
      >
        <span className="sr-only">{ariaLabel}</span>
      </StockVehicleLink>

      <div className={photoClass} data-vehicle-photo="">
        <VehicleImage
          src={cover}
          alt={display.titleWithYear}
          fill
          width={480}
          height={300}
          sizes={CARD_SIZES}
          srcSet={coverSet}
          priority={priority}
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-asphalt/70 via-transparent to-transparent"
          aria-hidden="true"
        />

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {badge ? (
            <span
              className={`px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : null}
          {!cover ? (
            <span className="bg-white/15 px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
              Sem foto
            </span>
          ) : null}
        </div>
      </div>

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
          className="pointer-events-auto"
        />
      </div>

      <div
        className="flex flex-1 flex-col px-2.5 pb-2 pt-1.5 sm:px-3 sm:pb-2.5 sm:pt-2"
        data-vehicle-body=""
      >
        {showDestaque ? (
          <span className="mb-1 self-start bg-brand px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
            Destaque
          </span>
        ) : null}
        <div className="min-w-0">
          {card.title ? (
            <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-tight text-cream sm:text-base">
              {card.title}
            </h3>
          ) : null}
          <CardFacts version={card.version} facts={card.facts} />
        </div>

        <div className="mt-1.5">
          {card.priceLabel ? (
            <p className="vehicle-card-price font-display font-bold leading-none tracking-tight text-brand tabular-nums">
              {card.priceLabel}
            </p>
          ) : null}
          <span className="card-open-label font-display text-[11px] font-semibold uppercase tracking-wide text-cream/85 transition group-hover:text-cream">
            Ver ficha
          </span>
        </div>
      </div>
    </article>
  );
}

function CardFacts({
  version,
  facts,
}: {
  version: string;
  facts: PublicCardFact[];
}) {
  const items = [
    ...(version ? [{ label: "Versão", value: version }] : []),
    ...facts,
  ];
  if (items.length === 0) return null;

  return (
    <dl className="vehicle-card-facts">
      {items.map((fact) => (
        <div key={fact.label} className="vehicle-card-fact">
          <dt className="sr-only">{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
