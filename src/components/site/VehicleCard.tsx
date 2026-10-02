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
  type VehicleCardRecord,
} from "@/lib/stock-query";
import {
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
} from "@/lib/vehicle-display";
import type { WhatsAppCampaign } from "@/lib/site";

export type VehicleCardData = VehicleCardRecord;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

/**
 * Card de servidor: só o favorito e o link hidratam no cliente.
 */
export function VehicleCard({
  vehicle,
  priority = false,
  returnTo,
  showDestaque = false,
  whatsappCampaign,
  showWhatsApp = true,
  largePhoto = false,
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
  returnTo?: string;
  showDestaque?: boolean;
  whatsappCampaign?: WhatsAppCampaign;
  showWhatsApp?: boolean;
  /** Foto 4:3 no celular — o maior retângulo nas duas colunas do estoque. */
  largePhoto?: boolean;
}) {
  const display = formatVehicleDisplay(vehicle);
  const card = publicCardFacts(vehicle);
  const cover = coverSrc(vehicle.photos);
  const coverSet = coverSrcSet(vehicle.photos);
  const badge = STATUS_BADGE[vehicle.status];
  const href = display.path;
  const sold = vehicle.status === "vendido";
  const whatsappMessage = formatVehicleWhatsAppMessage({
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    yearModel: vehicle.yearModel,
    transmission: vehicle.transmission,
    price: vehicle.price,
    path: href,
    isMoto: vehicle.category === "moto",
  });

  const photoClass = largePhoto
    ? "relative aspect-[4/3] overflow-hidden bg-asphalt sm:aspect-[16/10]"
    : "relative aspect-[16/10] overflow-hidden bg-asphalt";

  return (
    <article
      className={`vehicle-card card-lift group relative flex h-full flex-col overflow-hidden border border-white/10 bg-ink touch-manipulation ${
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
      </div>

      <div className="flex flex-1 items-start gap-1 p-3 sm:gap-2" data-vehicle-body="">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
          {showDestaque || badge || !cover ? (
            <div className="flex flex-wrap gap-1">
              {showDestaque ? (
                <span className="bg-brand px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
                  Destaque
                </span>
              ) : null}
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
          ) : null}
          <div className="min-w-0">
            {card.title ? (
              <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-cream sm:text-sm">
                {card.title}
              </h3>
            ) : null}
            {card.version ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">
                {card.version}
              </p>
            ) : null}
            <CardFacts facts={card.facts} />
          </div>

          <div className="mt-auto flex flex-col gap-1.5 border-t border-white/10 pt-2 sm:flex-row sm:items-end sm:justify-between sm:gap-2 sm:pt-2.5">
            {card.priceLabel ? (
              <p className="font-display text-lg font-bold leading-none text-brand sm:text-base">
                {card.priceLabel}
              </p>
            ) : null}
            <span className="inline-flex min-h-11 shrink-0 items-center font-display text-[11px] font-semibold uppercase tracking-wide text-cream/80 transition group-hover:text-cream">
              Ver ficha
            </span>
          </div>
        </div>
        <FavoriteButton
          vehicleId={vehicle.id}
          label={display.titleWithYear}
          value={vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
          className="relative z-10 shrink-0"
        />
      </div>
      <StockVehicleLink
        href={href}
        returnTo={returnTo}
        ariaLabel={
          card.priceLabel
            ? `${display.titleWithYear} — ${card.priceLabel}`
            : display.titleWithYear
        }
        className="absolute inset-0 z-[1] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span className="sr-only">{display.titleWithYear}</span>
      </StockVehicleLink>
      {!sold && showWhatsApp ? (
        <div className="relative z-10">
          <VehicleCardWhatsApp
            vehicleId={vehicle.id}
            label={display.fullLabel}
            message={whatsappMessage}
            value={vehicle.price}
            make={formatBrandName(vehicle.brand)}
            model={formatModelName(vehicle.model)}
            year={vehicle.yearModel}
            path={href}
            campaign={whatsappCampaign}
          />
        </div>
      ) : null}
    </article>
  );
}

function CardFacts({ facts }: { facts: PublicCardFact[] }) {
  if (facts.length === 0) return null;

  return (
    <dl className="mt-1.5 flex flex-wrap gap-y-0.5">
      {facts.map((fact, index) => (
        <div key={fact.label} className="flex items-baseline whitespace-nowrap">
          <dt className="sr-only">{fact.label}</dt>
          <dd className="font-display text-[12px] font-semibold leading-tight text-cream">
            {fact.value}
          </dd>
          {index < facts.length - 1 ? (
            <span className="px-1.5 text-muted" aria-hidden="true">
              ·
            </span>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
