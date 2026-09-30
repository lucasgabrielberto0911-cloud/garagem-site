import { IconShieldCheck } from "@/components/site/icons";
import { publicInspectionBadge } from "@/lib/vehicle-specs";

/**
 * Selo de confiança da ficha, perto do preço.
 * Mostra o texto salvo em `inspection`. Sem texto, não renderiza.
 */
export function VehicleInspectionBadge({
  inspection,
  className = "",
}: {
  inspection?: string | null;
  className?: string;
}) {
  const label = publicInspectionBadge(inspection);
  if (!label) return null;

  return (
    <p
      data-inspection-badge=""
      className={`flex w-full items-start gap-2 border border-emerald-400/45 bg-emerald-500/15 px-3 py-2.5 font-display text-sm font-semibold leading-snug text-emerald-50 ${className}`}
    >
      <IconShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    </p>
  );
}
