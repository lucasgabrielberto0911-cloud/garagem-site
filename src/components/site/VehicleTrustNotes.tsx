import {
  IconClock,
  IconClipboardCheck,
  IconFileText,
  IconShieldCheck,
} from "@/components/site/icons";

const NOTES = [
  {
    Icon: IconShieldCheck,
    label: "Garantia de 3 meses — motor e câmbio",
  },
  {
    Icon: IconClipboardCheck,
    label: "Vistoria completa antes de anunciar",
  },
  {
    Icon: IconFileText,
    label: "Documentação pronta",
  },
  {
    Icon: IconClock,
    label: "Atendimento online 8h–23h",
  },
] as const;

/** Confiança ao lado do preço — garantia, documentação e horário reais da loja. */
export function VehicleTrustNotes({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label="Por que comprar na Garagem"
      className={`border border-white/10 bg-asphalt/50 px-3 py-3 ${className}`}
    >
      <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-cream">
        Por que comprar na Garagem
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
      {NOTES.map(({ Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-2 text-left text-[11px] leading-snug text-cream/85"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-brand-light" />
          <span>{label}</span>
        </li>
      ))}
      </ul>
    </section>
  );
}
