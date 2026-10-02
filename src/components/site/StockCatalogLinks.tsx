import Link from "next/link";
import { formatCurrencyBRL, formatVehicleLabel } from "@/lib/format";
import { hasPublishablePrice } from "@/lib/seo";
import type { StockCatalogLink } from "@/lib/vehicles";
import { vehiclePath } from "@/lib/vehicle-slug";

/**
 * Índice no HTML inicial. A grade segue em lotes; cada ficha disponível
 * também aparece aqui como link, sem foto extra.
 */
export function StockCatalogLinks({
  vehicles,
}: {
  vehicles: StockCatalogLink[];
}) {
  if (vehicles.length === 0) return null;

  return (
    <nav aria-label="Todos os anúncios" className="mt-10 border-t border-white/10 pt-8">
      <h2 className="font-display text-lg font-semibold text-cream">
        Todos os anúncios
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        A grade carrega aos poucos. Aqui está cada seminovo disponível, para
        abrir a ficha direto — preço, ano e km.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
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
              <Link
                href={vehiclePath(vehicle)}
                prefetch={false}
                className="flex min-h-11 items-baseline justify-between gap-3 border border-white/10 bg-ink/40 px-3 py-2 text-sm text-cream transition hover:border-brand"
              >
                <span className="min-w-0">{label}</span>
                {price ? (
                  <span className="shrink-0 font-display font-semibold">{price}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
