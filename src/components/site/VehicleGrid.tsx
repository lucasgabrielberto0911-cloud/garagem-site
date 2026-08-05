import { ScrollReveal } from "@/components/site/ScrollReveal";
import { VehicleCard, type VehicleCardData } from "@/components/site/VehicleCard";

/**
 * Grade densa: cards menores, gaps curtos, largura alinhada à quantidade.
 */
function layoutForCount(count: number) {
  if (count <= 1) {
    return "max-w-sm grid-cols-1";
  }
  if (count === 2) {
    return "max-w-2xl grid-cols-1 sm:grid-cols-2";
  }
  if (count === 3) {
    return "max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  }
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

export function VehicleGrid({
  vehicles,
  reveal = false,
}: {
  vehicles: VehicleCardData[];
  reveal?: boolean;
}) {
  return (
    <div
      className={`mx-auto grid w-full gap-3 sm:gap-4 ${layoutForCount(vehicles.length)}`}
    >
      {vehicles.map((vehicle, index) =>
        reveal ? (
          <ScrollReveal
            key={vehicle.id}
            delay={index * 50}
            className="h-full min-w-0 w-full"
          >
            <VehicleCard vehicle={vehicle} />
          </ScrollReveal>
        ) : (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ),
      )}
    </div>
  );
}
