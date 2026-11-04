import type { ReactNode } from "react";

export function WizardSection({
  id,
  title,
  action,
  errorCount = 0,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  errorCount?: number;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-admin-form border bg-ink/50 ${errorCount ? "border-brand/50" : "border-white/10"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
          {title}
          {errorCount ? (
            <span className="ml-2 text-red-400">
              {errorCount === 1 ? "1 erro" : `${errorCount} erros`}
            </span>
          ) : null}
        </h3>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
