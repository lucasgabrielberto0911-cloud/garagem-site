import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import { formatCurrencyBRL, formatNumberBR, formatBrandName, formatModelName, formatVehicleLabel } from "@/lib/format";
import { coverSrc, type VehicleCardRecord } from "@/lib/stock-query";
import { vehiclePath } from "@/lib/vehicle-slug";

export type VehicleCardData = VehicleCardRecord;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

const CARD_SIZES = "(min-width: 1024px) 33vw, 50vw";

/**
 * Card de servidor: só o favorito e o link hidratam no cliente.
 */
export function VehicleCard({
  vehicle,
  priority = false,
  returnTo,
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
  returnTo?: string;
}) {
  const title = formatVehicleLabel(vehicle.brand, vehicle.model);
  const cover = coverSrc(vehicle.photos);
  const badge = STATUS_BADGE[vehicle.status];
  const href = vehiclePath(vehicle);
  const sold = vehicle.status === "vendido";
  const label = `${title}${vehicle.version ? ` ${vehicle.version}` : ""} ${vehicle.yearModel}`;

  const meta = [
    `${vehicle.yearModel}`,
    `${formatNumberBR(vehicle.km)} km`,
    vehicle.transmission,
  ].join(" · ");

  return (
    <article className="card-lift group relative flex h-full flex-col overflow-hidden border border-white/10 bg-ink touch-manipulation">
      <FavoriteButton
        vehicleId={vehicle.id}
        label={`${title} ${vehicle.yearModel}`}
        value={vehicle.price}
        make={formatBrandName(vehicle.brand)}
        model={formatModelName(vehicle.model)}
        year={vehicle.yearModel}
        className="absolute right-1.5 top-1.5 z-20"
      />

      <StockVehicleLink
        href={href}
        returnTo={returnTo}
        ariaLabel={`${title} ${vehicle.yearModel} — ${formatCurrencyBRL(vehicle.price)}`}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-asphalt">
          <VehicleImage
            src={cover}
            alt={title}
            fill
            sizes={CARD_SIZES}
            priority={priority}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-asphalt/70 via-transparent to-transparent"
            aria-hidden="true"
          />

          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {vehicle.featured ? (
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
              {title}
            </h3>
            {vehicle.version ? (
              <p className="mt-0.5 truncate text-[11px] text-muted sm:text-xs">
                {vehicle.version}
              </p>
            ) : null}
            <p className="mt-1 truncate text-[11px] text-muted sm:mt-1.5 sm:text-xs">
              {meta}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-1.5 border-t border-white/10 pt-2 sm:flex-row sm:items-end sm:justify-between sm:gap-2 sm:pt-2.5">
            <p className="font-display text-[15px] font-bold leading-none text-cream sm:text-base">
              {formatCurrencyBRL(vehicle.price)}
            </p>
            <span className="shrink-0 font-display text-[11px] font-semibold uppercase tracking-wide text-brand transition group-hover:text-brand-orange">
              Ver anúncio
            </span>
          </div>
        </div>
      </StockVehicleLink>
      {!sold ? (
        <VehicleCardWhatsApp
          vehicleId={vehicle.id}
          label={label}
          value={vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
        />
      ) : null}
    </article>
  );
}
