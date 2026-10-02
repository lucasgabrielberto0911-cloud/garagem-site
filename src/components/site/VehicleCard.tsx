import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { RememberVehicleSnapshot } from "@/components/site/RememberVehicleSnapshot";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { formatBrandName, formatModelName } from "@/lib/format";
import {
  publicCardFacts,
  type PublicCardFact,
  type PublicCardFactLabel,
} from "@/lib/public-card-facts";
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

/** Ano com km na primeira linha; câmbio com cidade na segunda. Não quebra no meio. */
const FACT_ROWS: PublicCardFactLabel[][] = [
  ["Ano", "Km"],
  ["Câmbio", "Cidade"],
];

/**
 * Card de servidor: só o favorito e o link hidratam no cliente.
 * O mesmo card entra na home, no estoque, nos favoritos e na faixa da ficha.
 */
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

  return (
    <article className="vehicle-card card-lift group relative grid h-full grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden border border-white/10 bg-ink touch-manipulation focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand">
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

      <div className="relative col-start-1 row-start-1 aspect-[16/10] overflow-hidden bg-asphalt">
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

      <div className="pointer-events-none relative z-20 col-start-1 row-start-2 flex h-11 items-center justify-between gap-2 px-2.5 sm:px-3">
        <div className="flex min-w-0 items-center">
          {showDestaque ? (
            <span className="bg-brand px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
              Destaque
            </span>
          ) : null}
        </div>
        <FavoriteButton
          vehicleId={vehicle.id}
          label={display.titleWithYear}
          value={vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
          appearance="ghost"
          className="pointer-events-auto"
        />
      </div>

      <div className="col-start-1 row-start-3 flex min-h-0 flex-col px-2.5 pb-1 sm:px-3 sm:pb-1.5">
        <div className="min-w-0">
          {card.title ? (
            <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-tight text-cream sm:text-base">
              {card.title}
            </h3>
          ) : null}
          {card.version ? (
            <p className="vehicle-card-version mt-0.5 line-clamp-2 text-pretty text-[12px] leading-snug text-muted sm:text-[13px]">
              {card.version}
            </p>
          ) : null}
          <CardFacts facts={card.facts} />
        </div>

        <div className="mt-auto border-t border-white/10 pt-2">
          {card.priceLabel ? (
            <p className="vehicle-card-price font-display font-bold leading-none tracking-tight text-brand tabular-nums">
              {card.priceLabel}
            </p>
          ) : null}
          <span className="flex min-h-11 w-full items-center justify-center text-center font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/80 transition group-hover:text-cream">
            Ver ficha
          </span>
        </div>
      </div>
    </article>
  );
}

function CardFacts({ facts }: { facts: PublicCardFact[] }) {
  if (facts.length === 0) return null;

  const byLabel = new Map(facts.map((fact) => [fact.label, fact]));
  const rows = FACT_ROWS.map((labels) =>
    labels.flatMap((label) => {
      const fact = byLabel.get(label);
      return fact ? [fact] : [];
    }),
  ).filter((row) => row.length > 0);

  return (
    <dl className="mt-1.5 space-y-0.5">
      {rows.map((row) => (
        <div
          key={row.map((fact) => fact.label).join("-")}
          className="flex min-w-0 flex-nowrap items-baseline overflow-hidden"
        >
          {row.map((fact, index) => (
            <div key={fact.label} className="flex items-baseline whitespace-nowrap">
              <dt className="sr-only">{fact.label}</dt>
              <dd className="vehicle-card-facts text-[12px] font-medium leading-4 text-cream sm:text-[13px]">
                {fact.value}
              </dd>
              {index < row.length - 1 ? (
                <span className="px-1 text-muted" aria-hidden="true">
                  ·
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </dl>
  );
}
