import type { Metadata } from "next";
import { SoldVehicleNotFound } from "@/components/site/SoldVehicleNotFound";
import { enrichVehiclesWithLqip } from "@/lib/photo-lqip";
import { site } from "@/lib/site";
import { getSoldFallbackVehicles } from "@/lib/vehicles";

export const metadata: Metadata = {
  title: `Anúncio indisponível | ${site.name}`,
  description:
    "Esse anúncio não está mais disponível. Veja opções parecidas no estoque da Garagem ou fale pelo WhatsApp.",
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

export default async function VehicleNotFound() {
  const vehicles = await enrichVehiclesWithLqip(
    await getSoldFallbackVehicles(),
    { limit: 12 },
  );
  return <SoldVehicleNotFound vehicles={vehicles} />;
}
