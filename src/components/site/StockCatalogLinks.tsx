import Link from "next/link";
import { formatCurrencyBRL, formatVehicleLabel } from "@/lib/format";
import { hasPublishablePrice } from "@/lib/seo";
import type { StockCatalogLink } from "@/lib/vehicles";
import { vehiclePath } from "@/lib/vehicle-slug";

/**
 * Índice no HTML inicial de /estoque. A grade visível segue em lotes;
 * cada ficha entra aqui como link para o crawler e o leitor de tela.
 * Fora da vista: não compete com os cards.
 */
export function StockCatalogLinks({
  vehicles,
}: {
  vehicles: StockCatalogLink[];
}) {
  if (vehicles.length === 0) return null;

  return (
    <nav aria-label="Todos os anúncios" className="stock-catalog-index">
      <h2>Todos os anúncios</h2>
      <p>
        A grade carrega aos poucos. Aqui está cada seminovo disponível, para
        abrir a ficha direto — preço, ano e km.
      </p>
      <ul>
        {vehicles.map((vehicle) => {
          const label = formatVehicleLabel(
            vehicle.brand,
            vehicle.model,
            vehicle.yearModel,
          );
          const price = hasPublishablePrice(vehicle.price)
            ? formatCurrencyBRL(vehicle.price)
            : "";
          return (
            <li key={vehicle.id}>
              <Link href={vehiclePath(vehicle)} prefetch={false} tabIndex={-1}>
                {label}
                {price ? <span> {price}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
