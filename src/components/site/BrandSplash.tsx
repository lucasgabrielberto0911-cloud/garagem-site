import { site } from "@/lib/site";

export function BrandSplash({
  label = "Carregando…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`brand-splash ${compact ? "brand-splash-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="brand-splash-field" aria-hidden="true">
        <span className="brand-splash-orb brand-splash-orb-1" />
        <span className="brand-splash-orb brand-splash-orb-2" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estático da splash */}
      <img
        src="/branding/logo-wordmark.webp"
        alt={site.name}
        width={480}
        height={86}
        decoding="async"
        className="brand-splash-logo"
      />
      <div className="brand-splash-bar" aria-hidden="true" />
      <p className="brand-splash-copy">{label}</p>
    </div>
  );
}
