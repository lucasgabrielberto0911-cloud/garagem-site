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
    <ul className="grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid-cols-4">
      {BADGES.map(({ Icon, label }) => (
        <li
          key={label}
          className="flex flex-col items-center gap-3 bg-asphalt px-4 py-7 text-center sm:flex-row sm:justify-center sm:gap-3.5 sm:text-left"
        >
          <Icon className="h-7 w-7 shrink-0 text-brand" />
          <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream sm:text-sm">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
