import {
  IconClipboardCheck,
  IconFileText,
  IconGauge,
  IconShieldCheck,
} from "@/components/site/icons";

const BADGES = [
  { Icon: IconClipboardCheck, label: "Vistoria Completa" },
  { Icon: IconShieldCheck, label: "Procedência Garantida" },
  { Icon: IconGauge, label: "KM Verificado" },
  { Icon: IconFileText, label: "Documentação OK" },
] as const;

export function TrustBadges() {
  return (
    <ul className="mx-auto grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid-cols-4">
      {BADGES.map(({ Icon, label }) => (
        <li
          key={label}
          className="flex flex-col items-center justify-center gap-2 bg-asphalt px-3 py-6 text-center sm:flex-row sm:gap-3.5 sm:py-7"
        >
          <Icon className="h-6 w-6 shrink-0 text-brand sm:h-7 sm:w-7" />
          <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-cream sm:text-sm">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
