import { VehicleCard, type VehicleCardData } from "@/components/site/VehicleCard";
import { featuredBadgeIds } from "@/lib/vehicle-display";

/**
 * Grade: 2 por linha no mobile (1 fica espaçoso demais), 3 no desktop.
 * Destaques da home usam 4 colunas no xl — o estoque fica em 3 por causa do filtro.
 */
function layoutForCount(count: number, desktopCols: 3 | 4) {
  if (count <= 1) {
    return "max-w-sm grid-cols-1";
  }
  if (count === 2) {
    return "max-w-2xl grid-cols-2";
  }
  if (desktopCols === 4) {
    return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  }
  return "grid-cols-2 lg:grid-cols-3";
}

export function VehicleGrid({
  vehicles,
  priorityCount = 0,
  returnTo,
  desktopCols = 3,
  destaqueLimit = 3,
}: {
  vehicles: VehicleCardData[];
  /** Quantos cards iniciais recebem `priority` (LCP). */
  priorityCount?: number;
  /** Caminho da listagem para retornar depois de abrir o anúncio. */
  returnTo?: string;
  /** 4 só na home (sem sidebar). Estoque permanece em 3. */
  desktopCols?: 3 | 4;
  /** 0 = nenhum selo Destaque (ex.: bloco que já é “destaques”). */
  destaqueLimit?: number;
}) {
  const destaqueIds = featuredBadgeIds(vehicles, destaqueLimit);
  return (
    <div
      className={`mx-auto grid w-full gap-2.5 sm:gap-4 ${layoutForCount(vehicles.length, desktopCols)}`}
    >
      {vehicles.map((vehicle, index) => (
        <div key={vehicle.id} className="h-full min-w-0 w-full">
          <VehicleCard
            vehicle={vehicle}
            priority={index < priorityCount}
            returnTo={returnTo}
            showDestaque={destaqueIds.has(vehicle.id)}
          />
        </div>
      ))}
    </div>
  );
}
