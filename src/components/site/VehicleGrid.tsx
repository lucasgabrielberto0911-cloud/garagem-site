import { VehicleCard, type VehicleCardData } from "@/components/site/VehicleCard";
import { featuredBadgeIds } from "@/lib/vehicle-display";
import type { WhatsAppCarPageOrigin } from "@/lib/whatsapp-car-message";

/** Mesmas margens e o mesmo card em todas as listas, com duas colunas no celular e 4 no desktop. */
export function VehicleGrid({
  vehicles,
  priorityCount = 0,
  returnTo,
  desktopCols = 4,
  destaqueLimit = 3,
  hideInterest = false,
  pageOrigin,
}: {
  vehicles: VehicleCardData[];
  priorityCount?: number;
  returnTo?: string;
  desktopCols?: 3 | 4;
  destaqueLimit?: number;
  /** Esconde o "Tenho interesse" dos cards (ficha: o card só abre o anúncio). */
  hideInterest?: boolean;
  /** Origem curta da página para a mensagem do WhatsApp (ex.: "home", "card do estoque"). */
  pageOrigin?: WhatsAppCarPageOrigin;
  /** Mantido para compatibilidade; todos os cards usam agora a mesma foto 4:3. */
  photoLayout?: "default" | "stock";
}) {
  const destaqueIds = featuredBadgeIds(vehicles, destaqueLimit);
  const cols = desktopCols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
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
              hideInterest={hideInterest}
              pageOrigin={pageOrigin}
            />
          </div>
        );
      })}
    </div>
  );
}
