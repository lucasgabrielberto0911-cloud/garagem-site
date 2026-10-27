import type { VehicleSeal } from "@/lib/vehicle-seals";

/**
 * Selos da ficha (procedência, revisões, opcionais). Chips pequenos e neutros,
 * com um traço vermelho da loja. Sem selo, não renderiza.
 */
export function VehicleSeals({
  seals,
  className = "",
}: {
  seals: readonly VehicleSeal[];
  className?: string;
}) {
  if (seals.length === 0) return null;

  return (
    <ul
      aria-label="Destaques do anúncio"
      data-vehicle-seals=""
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {seals.map((seal) => (
        <li
          key={seal.id}
          data-vehicle-seal={seal.id}
          className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold leading-snug text-cream"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-brand" />
          {seal.label}
        </li>
      ))}
    </ul>
  );
}
