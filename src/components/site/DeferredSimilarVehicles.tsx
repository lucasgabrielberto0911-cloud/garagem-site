import { getRelatedVehicles } from "@/lib/vehicles";
import { SimilarVehicles } from "./SimilarVehicles";

/** Consulta secundária isolada para não segurar foto e contato da ficha. */
export async function DeferredSimilarVehicles({
  query,
  ...props
}: Omit<Parameters<typeof SimilarVehicles>[0], "vehicles"> & {
  query: Parameters<typeof getRelatedVehicles>;
}) {
  const vehicles = await getRelatedVehicles(...query);
  return <SimilarVehicles {...props} vehicles={vehicles} />;
}
