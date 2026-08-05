import { ScrollReveal } from "@/components/site/ScrollReveal";
import { VehicleCard, type VehicleCardData } from "@/components/site/VehicleCard";

/**
 * Ajusta colunas e largura máxima à quantidade de cards.
 * Antes: 1 item + `xl:grid-cols-4` + `max-w-sm` espremia o card numa faixa
 * estreita (~1/4 de 24rem) — exatamente o bug dos destaques.
 */
function layoutForCount(count: number) {
  if (count <= 1) {
    return "max-w-md grid-cols-1";
  }
  if (count === 2) {
    return "max-w-3xl grid-cols-1 sm:grid-cols-2";
  }
  if (count === 3) {
    return "max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
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
      className={`mx-auto grid w-full gap-5 ${layoutForCount(vehicles.length)}`}
    >
      {vehicles.map((vehicle, index) =>
        reveal ? (
          <ScrollReveal
            key={vehicle.id}
            delay={index * 70}
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
