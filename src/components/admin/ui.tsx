import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Kit de UI do painel. Centraliza espaçamento, bordas e estados para que todas
 * as telas do admin tenham a mesma aparência sem repetir classes.
 */

export const inputClass =
  "w-full border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream outline-none transition placeholder:text-muted focus:border-brand";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 bg-brand px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:cursor-not-allowed disabled:opacity-60",
  outline:
    "inline-flex items-center justify-center gap-2 border border-white/15 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted transition hover:text-cream disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 border border-brand/50 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-60",
} as const;

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 h-1 w-16 bg-brand-gradient" aria-hidden="true" />
        <h1 className="font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`border border-white/10 bg-ink/50 ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "brand" | "warning" | "success";
  href?: string;
}) {
  const tones = {
    default: { border: "border-white/10", value: "text-cream" },
    brand: { border: "border-brand/50", value: "text-brand" },
    warning: { border: "border-brand-orange/50", value: "text-brand-orange" },
    success: { border: "border-emerald-400/40", value: "text-emerald-300" },
  } as const;
  const tokens = tones[tone];

  const content = (
    <>
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p
        title={String(value)}
        className={`mt-2 font-display font-bold leading-[1.15] tracking-tight tabular-nums whitespace-nowrap ${tokens.value} [font-size:clamp(0.92rem,10.5cqi,1.65rem)]`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 truncate text-xs text-muted" title={hint}>
          {hint}
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`block min-w-0 overflow-hidden [container-type:inline-size] border bg-ink/50 px-4 py-4 transition hover:bg-white/[0.04] sm:px-5 ${tokens.border}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={`min-w-0 overflow-hidden [container-type:inline-size] border bg-ink/50 px-4 py-4 sm:px-5 ${tokens.border}`}
    >
      {content}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-white/10 text-muted",
  brand: "bg-brand/15 text-brand",
  warning: "bg-brand-orange/15 text-brand-orange",
  success: "bg-emerald-400/15 text-emerald-300",
  info: "bg-sky-400/15 text-sky-300",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-wider ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-white/15 px-6 py-14 text-center">
      {icon ? <div className="text-white/20">{icon}</div> : null}
      <h2 className="mt-4 font-display text-lg font-semibold text-cream">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  required = false,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
        {label}
        {required ? <span className="ml-1 text-brand">*</span> : null}
      </span>
      {children}
      {error ? <p className="mt-1.5 text-xs text-brand">{error}</p> : null}
      {!error && hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </label>
  );
}

/** Skeleton simples reaproveitado nas telas de loading do admin. */
export function AdminSkeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
