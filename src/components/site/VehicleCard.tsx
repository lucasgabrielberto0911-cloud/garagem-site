import Link from "next/link";
import type { Photo, Vehicle } from "@prisma/client";
import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";

export type VehicleCardData = Vehicle & { photos: Photo[] };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

/**
 * Card compacto para listagens: foto, identificação, 3 dados-chave e preço.
 * O WhatsApp fica no anúncio — aqui o clique leva ao detalhe.
 */
export function VehicleCard({
  vehicle,
  priority = false,
}: {
  vehicle: VehicleCardData;
  /** Primeiros cards da home: prioriza LCP. */
  priority?: boolean;
}) {
  const title = `${vehicle.brand} ${vehicle.model}`;
  const cover = vehicle.photos[0]?.url;
  const badge = STATUS_BADGE[vehicle.status];
  const categoryLabel = vehicleCategoryLabel(vehicle.category);
  const href = `/estoque/${vehicle.id}`;

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
        className="absolute right-2 top-2 z-10"
      />

      <Link
        href={href}
        prefetch={false}
        className="relative block aspect-[16/10] overflow-hidden bg-asphalt"
      >
        <VehicleImage
          src={cover}
          alt={title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          quality={priority ? 72 : 65}
          priority={priority}
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-asphalt/70 via-transparent to-transparent"
          aria-hidden="true"
        />

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {vehicle.featured ? (
            <span className="bg-brand px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-cream">
              Destaque
            </span>
          ) : null}
          {badge ? (
            <span
              className={`px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : null}
          {!cover ? (
            <span className="bg-white/15 px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-cream">
              Sem foto
            </span>
          ) : null}
        </div>

        <span className="absolute bottom-2 left-2 bg-asphalt/80 px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-wider text-cream/90 backdrop-blur">
          {categoryLabel}
        </span>

        {vehicle.photos.length > 1 ? (
          <span className="absolute bottom-2 right-2 bg-asphalt/80 px-1.5 py-0.5 text-[10px] text-cream backdrop-blur">
            {vehicle.photos.length} fotos
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-semibold leading-snug text-cream">
            <Link href={href} prefetch={false} className="transition hover:text-brand">
              {title}
            </Link>
          </h3>
          {vehicle.version ? (
            <p className="mt-0.5 truncate text-[11px] text-muted">{vehicle.version}</p>
          ) : null}
          <p className="mt-1.5 truncate text-[11px] text-muted">{meta}</p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/10 pt-2.5">
          <p className="font-display text-base font-bold leading-none text-cream sm:text-lg">
            {formatCurrencyBRL(vehicle.price)}
          </p>
          <Link
            href={href}
            prefetch={false}
            className="shrink-0 font-display text-[10px] font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
          >
            Ver anúncio
          </Link>
        </div>
      </div>
    </article>
  );
}
