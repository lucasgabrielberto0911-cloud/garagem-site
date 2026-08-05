import Link from "next/link";
import type { Photo, Vehicle } from "@prisma/client";
import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import {
  IconCalendar,
  IconFuel,
  IconGauge,
  IconGearShift,
  IconWhatsApp,
} from "@/components/site/icons";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { whatsappUrl } from "@/lib/site";

export type VehicleCardData = Vehicle & { photos: Photo[] };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

export function VehicleCard({ vehicle }: { vehicle: VehicleCardData }) {
  const title = `${vehicle.brand} ${vehicle.model}`;
  const cover = vehicle.photos[0]?.url;
  const badge = STATUS_BADGE[vehicle.status];
  const interestMessage = `Olá! Tenho interesse no ${title}${
    vehicle.version ? ` ${vehicle.version}` : ""
  } ${vehicle.yearModel}`;

  return (
    <article className="card-lift group relative flex h-full flex-col border border-white/10 bg-ink touch-manipulation">
      <FavoriteButton
        vehicleId={vehicle.id}
        label={`${title} ${vehicle.yearModel}`}
        className="absolute right-2 top-2 z-10"
      />
      <Link
        href={`/estoque/${vehicle.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-asphalt"
      >
        <VehicleImage
          src={cover}
          alt={title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100"
          aria-hidden="true"
        />
        <div className="absolute left-0 top-3 flex flex-col items-start gap-1.5">
          {vehicle.featured ? (
            <span className="bg-brand px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
              Destaque
            </span>
          ) : null}
          {badge ? (
            <span
              className={`px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        {vehicle.photos.length > 1 ? (
          <span className="absolute bottom-3 right-3 bg-asphalt/80 px-2.5 py-1 text-[11px] font-medium text-cream backdrop-blur">
            {vehicle.photos.length} fotos
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
          {vehicle.brand}
        </p>
        <h3 className="mt-1 font-display text-base font-semibold leading-snug text-cream sm:text-lg">
          <Link href={`/estoque/${vehicle.id}`} className="hover:text-brand">
            {vehicle.model}
            {vehicle.version ? (
              <span className="block truncate text-xs font-normal text-muted">
                {vehicle.version}
              </span>
            ) : null}
          </Link>
        </h3>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
          <Spec
            Icon={IconCalendar}
            label={`${vehicle.year}/${vehicle.yearModel}`}
          />
          <Spec Icon={IconGauge} label={`${formatNumberBR(vehicle.km)} km`} />
          <Spec Icon={IconFuel} label={vehicle.fuel} />
          <Spec Icon={IconGearShift} label={vehicle.transmission} />
        </dl>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              A partir de
            </p>
            <p className="font-display text-xl font-bold text-cream sm:text-2xl">
              {formatCurrencyBRL(vehicle.price)}
            </p>
          </div>

          <a
            href={whatsappUrl(interestMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-btn inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 px-4 py-3 font-display text-xs font-semibold uppercase tracking-wide text-white touch-manipulation sm:w-auto"
          >
            <IconWhatsApp className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}

function Spec({
  Icon,
  label,
}: {
  Icon: (props: { className?: string }) => JSX.Element;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" />
      <dd className="truncate">{label}</dd>
    </div>
  );
}
