import {
  IconClipboardCheck,
  IconFileText,
  IconGauge,
  IconShieldCheck,
} from "@/components/site/icons";

const BADGES = [
  { Icon: IconShieldCheck, label: "Garantia 3 meses · motor e câmbio" },
  { Icon: IconClipboardCheck, label: "Vistoria completa" },
  { Icon: IconGauge, label: "km conferido" },
  { Icon: IconFileText, label: "Documentação em dia" },
] as const;

export function TrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <ul className="mx-auto grid grid-cols-1 gap-3 sm:grid-cols-2">
      {BADGES.map(({ Icon, label }) => (
        <li
          key={label}
          className={`flex items-center bg-ink text-left ${
            compact
              ? "gap-2.5 px-4 py-3"
              : "gap-3.5 px-5 py-4"
          }`}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center bg-brand/10">
            <Icon
              className={`text-brand-light ${compact ? "h-4 w-4" : "h-5 w-5"}`}
            />
          </span>
          <span
            className={`font-display font-semibold leading-snug text-cream ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
