import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { RememberVehicleSnapshot } from "@/components/site/RememberVehicleSnapshot";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import { formatCurrencyBRL, formatBrandName, formatModelName } from "@/lib/format";
import { coverSrc, coverSrcSet, type VehicleCardRecord } from "@/lib/stock-query";
import {
  formatUpdatedAt,
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
} from "@/lib/vehicle-display";

export type VehicleCardData = VehicleCardRecord;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

const CARD_SIZES =
  "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw";

/**
 * Card de servidor: só o favorito e o link hidratam no cliente.
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
  const cover = coverSrc(vehicle.photos);
  const coverSet = coverSrcSet(vehicle.photos);
  const badge = STATUS_BADGE[vehicle.status];
  const href = display.path;
  const sold = vehicle.status === "vendido";
  const updated =
    vehicle.updatedAt != null ? formatUpdatedAt(vehicle.updatedAt) : "";
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

  return (
    <article className="vehicle-card card-lift group relative flex h-full flex-col overflow-hidden border border-white/10 bg-ink touch-manipulation">
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
          updatedAt:
            vehicle.updatedAt instanceof Date
              ? vehicle.updatedAt.toISOString()
              : vehicle.updatedAt ?? null,
          photos: vehicle.photos,
        }}
      />
      <FavoriteButton
        vehicleId={vehicle.id}
        label={display.titleWithYear}
        value={vehicle.price}
        make={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        year={vehicle.yearModel}
        className="absolute right-1.5 top-1.5 z-20"
      />

      <StockVehicleLink
        href={href}
        returnTo={returnTo}
        ariaLabel={`${display.titleWithYear} — ${formatCurrencyBRL(vehicle.price)}`}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-asphalt">
          <VehicleImage
            src={cover}
            alt={display.title}
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
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[13px] font-semibold leading-snug text-cream sm:text-sm">
              {display.title}
            </h3>
            {display.version ? (
              <p className="mt-0.5 truncate text-[11px] text-muted sm:text-xs">
                {display.version}
              </p>
            ) : null}
            <p className="mt-1 truncate text-[11px] text-muted sm:mt-1.5 sm:text-xs">
              {display.metaParts.join(" · ")}
            </p>
            {updated ? (
              <p className="mt-0.5 truncate text-[10px] text-muted/90">{updated}</p>
            ) : null}
          </div>

          <div className="mt-auto flex flex-col gap-1.5 border-t border-white/10 pt-2 sm:flex-row sm:items-end sm:justify-between sm:gap-2 sm:pt-2.5">
            <p className="font-display text-[15px] font-bold leading-none text-cream sm:text-base">
              {formatCurrencyBRL(vehicle.price)}
            </p>
            <span className="shrink-0 font-display text-[11px] font-semibold uppercase tracking-wide text-cream/70 transition group-hover:text-cream">
              Ver detalhes
            </span>
          </div>
        </div>
      </StockVehicleLink>
      {!sold ? (
        <VehicleCardWhatsApp
          vehicleId={vehicle.id}
          label={display.fullLabel}
          message={whatsappMessage}
          value={vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
        />
      ) : null}
    </article>
  );
}
