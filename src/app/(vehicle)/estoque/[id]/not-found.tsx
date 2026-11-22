import { SoldVehicleNotFound } from "@/components/site/SoldVehicleNotFound";
import { enrichVehiclesWithLqip } from "@/lib/photo-lqip";
import { getSoldFallbackVehicles } from "@/lib/vehicles";

export default async function VehicleNotFound() {
  const vehicles = await enrichVehiclesWithLqip(
    await getSoldFallbackVehicles(),
    { limit: 16 },
  );
  return <SoldVehicleNotFound vehicles={vehicles} />;
}
