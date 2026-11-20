import { dossierChipsToSeals, type VehicleSeal } from "@/lib/vehicle-seals";

/**
 * Selos da ficha (procedência, revisões, opcionais e dossiê). Chips pequenos e
 * neutros, com um traço vermelho da loja. Sem selo, não renderiza.
 */
export function VehicleSeals({
  seals,
  chips = [],
  className = "",
  optionalsHref,
}: {
  seals: readonly VehicleSeal[];
  /** Chips de dossiê já filtrados (`publicDossierChips`: chave reserva, manual, vídeo). */
  chips?: readonly string[];
  className?: string;
  /** Quando existe, o selo de opcionais vira âncora para a lista. */
  optionalsHref?: string;
}) {
  const existingIds = new Set(seals.map((seal) => seal.id));
  const extraSeals = dossierChipsToSeals(chips).filter(
    (seal) => !existingIds.has(seal.id),
  );
  const allSeals = [...seals, ...extraSeals];
  if (allSeals.length === 0) return null;

  return (
    <ul
      aria-label="Destaques do anúncio"
      data-vehicle-seals=""
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {allSeals.map((seal) => (
        <li
          key={seal.id}
          data-vehicle-seal={seal.id}
          className="inline-flex items-center gap-2 border border-white/20 bg-ink/80 px-2.5 py-1 text-sm font-semibold leading-snug text-cream"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-brand-light" />
          {optionalsHref && seal.id === "opcionais" ? (
            <a href={optionalsHref} className="underline-offset-4 hover:underline">
              {seal.label}
            </a>
          ) : (
            seal.label
          )}
        </li>
      ))}
    </ul>
  );
}
