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
    <>
      {/* Mobile: scroll horizontal leve */}
      <ul className="flex items-center gap-6 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
        {BADGES.map(({ Icon, label }) => (
          <li
            key={label}
            className="flex shrink-0 items-center gap-2.5 text-sm"
          >
            <Icon className="h-5 w-5 shrink-0 text-brand" />
            <span className="whitespace-nowrap font-display text-xs font-semibold uppercase tracking-wider text-cream">
              {label}
            </span>
          </li>
        ))}
      </ul>

      {/* Desktop: grade */}
      <ul className="hidden gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid lg:grid-cols-4">
        {BADGES.map(({ Icon, label }) => (
          <li
            key={label}
            className="flex items-center justify-center gap-3.5 bg-asphalt px-4 py-7"
          >
            <Icon className="h-7 w-7 shrink-0 text-brand" />
            <span className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
