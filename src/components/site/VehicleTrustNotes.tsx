import {
  IconHandshake,
  IconMapPin,
  IconShieldCheck,
} from "@/components/site/icons";

const NOTES = [
  {
    Icon: IconShieldCheck,
    label: "Garantia de 3 meses",
  },
  {
    Icon: IconHandshake,
    label: "Atendimento humano",
  },
  {
    Icon: IconMapPin,
    label: "Loja digital; visita combinada",
  },
] as const;

/** Bloco curto ao lado do CTA — sem números inventados nem urgência. */
export function VehicleTrustNotes({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`grid gap-2 border border-white/10 bg-asphalt/50 px-3 py-3 sm:grid-cols-3 ${className}`}
    >
      {NOTES.map(({ Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-2 text-left text-[11px] leading-snug text-cream/85"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
