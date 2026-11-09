import { IconClipboardCheck, IconMapPin, IconShieldCheck } from "@/components/site/icons";

const NOTES = [
  { Icon: IconShieldCheck, label: "Garantia de 3 meses — motor e câmbio" },
  { Icon: IconClipboardCheck, label: "Vistoria da loja" },
  { Icon: IconMapPin, label: "Linhares/ES" },
] as const;

/**
 * Faixa de confiança do card da ficha no computador: garantia, vistoria e
 * cidade da loja. Se o admin preencheu a garantia deste carro, ela substitui
 * a frase padrão. Documentação e demais detalhes ficam na coluna principal.
 */
export function VehicleTrustNotes({
  className = "",
  warranty,
}: {
  className?: string;
  warranty?: string | null;
}) {
  const own = warranty?.trim();
  const notes = own
    ? [{ Icon: IconShieldCheck, label: `Garantia deste carro: ${own}` }, ...NOTES.slice(1)]
    : NOTES;
  return (
    <ul
      aria-label="Garantia e vistoria"
      data-trust-notes=""
      className={`grid gap-1.5 border-y border-white/10 py-3 ${className}`}
    >
      {notes.map(({ Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-left text-xs leading-snug text-cream/90">
          <Icon className="h-4 w-4 shrink-0 text-brand-light" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        </li>
      ))}
    </ul>
  );
}
