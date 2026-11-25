import { IconClipboardCheck, IconMapPin, IconShieldCheck } from "@/components/site/icons";
import { vehicleWarrantyNote } from "@/lib/vehicle-conditions";

/**
 * Faixa de confiança da ficha: garantia (a do veículo, se cadastrada), vistoria
 * e cidade da loja. `compact` é a versão da primeira tela do celular: sem
 * bordas e sem a cidade, que aparece em "Atendimento". No desktop o selo
 * "Vistoriado pela Garagem" já fica perto do preço, então não se repete aqui.
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
    { Icon: IconClipboardCheck, label: "Vistoriado pela Garagem", badge: true },
    { Icon: IconShieldCheck, label: vehicleWarrantyNote(warranty), badge: false },
    ...(compact ? [] : [{ Icon: IconMapPin, label: "Linhares/ES", badge: false }]),
  ];
  return (
    <ul
      aria-label="Garantia e vistoria"
      data-trust-notes=""
      className={`grid gap-1.5 ${compact ? "" : "border-y border-white/[0.12] py-3"} ${className}`}
    >
      {notes.map(({ Icon, label, badge }) => (
        <li
          key={label}
          data-vistoriado-seal={badge ? "" : undefined}
          className={`flex items-center gap-2 text-left text-sm leading-snug ${
            badge
              ? "font-display font-semibold text-cream lg:hidden"
              : compact
                ? "text-cream"
                : "text-cream/95"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0 text-brand-light" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        </li>
      ))}
    </ul>
  );
}
