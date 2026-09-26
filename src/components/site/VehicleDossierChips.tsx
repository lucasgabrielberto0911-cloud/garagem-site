import {
  publicDossierChips,
  type PublicDossierFlags,
} from "@/lib/vehicle-dossier";

/** Chave reserva, manual e vídeo — só o que a loja confirmou neste veículo. */
export function VehicleDossierChips({
  hasSpareKey = false,
  hasManual = false,
  hasVideo = false,
  className = "",
}: PublicDossierFlags & { className?: string }) {
  const chips = publicDossierChips({ hasSpareKey, hasManual, hasVideo });
  if (chips.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {chips.map((label) => (
        <li
          key={label}
          className="border border-white/15 bg-white/5 px-2 py-1 font-display text-[11px] font-semibold uppercase tracking-wider text-cream"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}
