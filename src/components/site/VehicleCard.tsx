import Link from "next/link";
import type { Photo, Vehicle } from "@prisma/client";
import { VehicleImage } from "@/components/VehicleImage";
import {
  IconCalendar,
  IconFuel,
  IconGauge,
  IconGearShift,
} from "@/components/site/icons";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";

export type VehicleCardData = Vehicle & { photos: Photo[] };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

export function VehicleCard({ vehicle }: { vehicle: VehicleCardData }) {
  const title = `${vehicle.brand} ${vehicle.model}`;
  const cover = vehicle.photos[0]?.url;
  const badge = STATUS_BADGE[vehicle.status];

  return (
    <article className="group flex flex-col border border-white/10 bg-ink transition hover:border-brand/50">
      <Link
        href={`/estoque/${vehicle.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-asphalt"
      >
        <VehicleImage
          src={cover}
          alt={title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {vehicle.featured ? (
          <span className="absolute left-0 top-3 bg-brand px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
            Destaque
          </span>
        ) : null}
        {badge ? (
          <span
            className={`absolute right-3 top-3 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
          >
            {badge.label}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold leading-snug text-cream">
          <Link href={`/estoque/${vehicle.id}`} className="hover:text-brand">
            {title}
          </Link>
        </h3>
        {vehicle.version ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted">{vehicle.version}</p>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
          <Spec Icon={IconCalendar} label={`${vehicle.year}/${vehicle.yearModel}`} />
          <Spec Icon={IconGauge} label={`${formatNumberBR(vehicle.km)} km`} />
          <Spec Icon={IconFuel} label={vehicle.fuel} />
          <Spec Icon={IconGearShift} label={vehicle.transmission} />
        </dl>

        <div className="mt-auto pt-5">
          <p className="font-display text-xl font-bold text-cream">
            {formatCurrencyBRL(vehicle.price)}
          </p>
          <Link
            href={`/estoque/${vehicle.id}`}
            className="mt-3 block w-full border border-white/15 py-2.5 text-center font-display text-xs font-semibold uppercase tracking-wide text-cream transition group-hover:border-brand group-hover:bg-brand group-hover:text-cream"
          >
            Ver detalhes
          </Link>
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
