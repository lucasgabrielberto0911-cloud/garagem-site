import { ScrollReveal } from "@/components/site/ScrollReveal";
import { VehicleCard, type VehicleCardData } from "@/components/site/VehicleCard";

/**
 * Com poucos veículos, uma grade de 3-4 colunas deixa os cards jogados no
 * canto esquerdo. Limitar a largura conforme a quantidade mantém o bloco
 * centralizado em qualquer tamanho de estoque.
 */
function widthForCount(count: number) {
  if (count <= 1) return "max-w-sm";
  if (count === 2) return "max-w-3xl";
  if (count === 3) return "max-w-5xl";
  return "";
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
      className={`mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${widthForCount(
        vehicles.length,
      )}`}
    >
      {vehicles.map((vehicle, index) =>
        reveal ? (
          <ScrollReveal key={vehicle.id} delay={index * 70}>
            <VehicleCard vehicle={vehicle} />
          </ScrollReveal>
        ) : (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ),
      )}
    </div>
  );
}
