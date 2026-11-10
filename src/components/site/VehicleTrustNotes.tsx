import { IconClipboardCheck, IconMapPin, IconShieldCheck } from "@/components/site/icons";
import { vehicleWarrantyNote } from "@/lib/vehicle-conditions";

/**
 * Faixa de confiança da ficha: garantia (a do veículo, se cadastrada), vistoria
 * e cidade da loja. `compact` é a versão da primeira tela do celular: sem
 * bordas e sem a cidade, que aparece em "Onde estamos".
 */
export function VehicleTrustNotes({
  className = "",
  warranty,
  compact = false,
}: {
  className?: string;
  warranty?: string | null;
  compact?: boolean;
}) {
  const notes = [
    { Icon: IconShieldCheck, label: vehicleWarrantyNote(warranty) },
    { Icon: IconClipboardCheck, label: "Vistoria da loja" },
    ...(compact ? [] : [{ Icon: IconMapPin, label: "Linhares/ES" }]),
  ];
  return (
    <ul
      aria-label="Garantia e vistoria"
      data-trust-notes=""
      className={`grid gap-1.5 ${compact ? "" : "border-y border-white/10 py-3"} ${className}`}
    >
      {notes.map(({ Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-left text-sm leading-snug text-cream/90">
          <Icon className="h-4 w-4 shrink-0 text-brand-light" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        </li>
      ))}
    </ul>
  );
}
