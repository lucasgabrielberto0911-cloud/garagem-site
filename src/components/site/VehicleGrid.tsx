import { ScrollReveal } from "@/components/site/ScrollReveal";
import { VehicleCard, type VehicleCardData } from "@/components/site/VehicleCard";

/**
 * Grade: 2 por linha no mobile (1 fica espaçoso demais), 3 no desktop.
 * Um único veículo continua em coluna única.
 */
function layoutForCount(count: number) {
  if (count <= 1) {
    return "max-w-sm grid-cols-1";
  }
  if (count === 2) {
    return "max-w-2xl grid-cols-2";
  }
  return "grid-cols-2 lg:grid-cols-3";
}

export function VehicleGrid({
  vehicles,
  reveal = false,
  priorityCount = 0,
  returnTo,
}: {
  vehicles: VehicleCardData[];
  reveal?: boolean;
  /** Quantos cards iniciais recebem `priority` (LCP). */
  priorityCount?: number;
  /** Caminho da listagem para retornar depois de abrir o anúncio. */
  returnTo?: string;
}) {
  return (
    <div
      className={`mx-auto grid w-full gap-3 sm:gap-4 ${layoutForCount(vehicles.length)}`}
    >
      {vehicles.map((vehicle, index) => {
        const card = (
          <VehicleCard
            vehicle={vehicle}
            priority={index < priorityCount}
            returnTo={returnTo}
          />
        );

        if (!reveal) {
          return (
            <div key={vehicle.id} className="h-full min-w-0 w-full">
              {card}
            </div>
          );
        }

        // Sem delay nos primeiros cards para não atrasar o LCP.
        const delay =
          index < Math.max(priorityCount, 2) ? 0 : Math.min(index * 40, 160);

        return (
          <ScrollReveal
            key={vehicle.id}
            delay={delay}
            className="h-full min-w-0 w-full"
          >
            {card}
          </ScrollReveal>
        );
      })}
    </div>
  );
}
