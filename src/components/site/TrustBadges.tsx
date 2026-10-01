import {
  IconClipboardCheck,
  IconFileText,
  IconGauge,
  IconShieldCheck,
} from "@/components/site/icons";

const BADGES = [
  { Icon: IconShieldCheck, label: "Garantia 3 meses · motor e câmbio" },
  { Icon: IconClipboardCheck, label: "Vistoria completa" },
  { Icon: IconGauge, label: "KM conferido" },
  { Icon: IconFileText, label: "Documentação em dia" },
] as const;

export function TrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="mx-auto grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid-cols-4">
      {BADGES.map(({ Icon, label }) => (
        <li
          key={label}
          className={`flex flex-col items-center justify-center bg-asphalt px-3 text-center sm:flex-row ${
            compact
              ? "gap-1.5 py-3 sm:gap-2.5 sm:py-3.5"
              : "gap-2 py-6 sm:gap-3.5 sm:py-7"
          }`}
        >
          <Icon
            className={`shrink-0 text-brand ${compact ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7"}`}
          />
          <span
            className={`font-display font-semibold uppercase text-cream ${
              compact
                ? "text-[10px] leading-tight tracking-wide sm:text-xs"
                : "text-[11px] tracking-wider sm:text-sm"
            }`}
          >
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
