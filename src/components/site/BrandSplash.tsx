import { site } from "@/lib/site";

export function BrandSplash({
  label = "",
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
      aria-label={label || site.name}
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
        fetchPriority={compact ? "low" : "high"}
        className="brand-splash-logo"
      />
      <div className="brand-splash-bar" aria-hidden="true" />
      {label ? <p className="brand-splash-copy">{label}</p> : null}
    </div>
  );
}
