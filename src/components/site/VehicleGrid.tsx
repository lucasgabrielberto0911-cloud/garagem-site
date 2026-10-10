import { VehicleCard, type VehicleCardData } from "@/components/site/VehicleCard";
import { featuredBadgeIds } from "@/lib/vehicle-display";

/** Mesmas margens e o mesmo card em todas as listas, com duas colunas no celular. */
export function VehicleGrid({
  vehicles,
  priorityCount = 0,
  returnTo,
  desktopCols = 3,
  destaqueLimit = 3,
}: {
  vehicles: VehicleCardData[];
  priorityCount?: number;
  returnTo?: string;
  desktopCols?: 3 | 4;
  destaqueLimit?: number;
  /** Mantido para compatibilidade; todos os cards usam agora a mesma foto 4:3. */
  photoLayout?: "default" | "stock";
}) {
  const destaqueIds = featuredBadgeIds(vehicles, destaqueLimit);
  const cols = desktopCols === 4 ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3";
  return (
    <div className={`listing-card-grid grid grid-cols-2 ${cols}`}>
      {vehicles.map((vehicle, index) => {
        const high = index === 0 && priorityCount > 0;
        return (
          <div key={vehicle.id} className="listing-card-item min-w-0">
            <VehicleCard
              vehicle={vehicle}
              priority={high}
              eager={!high && index < priorityCount}
              returnTo={returnTo}
              showDestaque={destaqueIds.has(vehicle.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
