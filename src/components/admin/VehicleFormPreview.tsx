import type { ReactNode } from "react";

/** The full check remains available without pushing mobile fields below the fold. */
export function VehicleFormPreview({ children, price }: { children: ReactNode; price: string }) {
  return (
    <>
      <section className="hidden border-l-2 border-brand bg-ink/50 p-4 sm:block" aria-label="Conferência do anúncio">
        {children}
      </section>
      <details className="border border-white/10 bg-ink/50 sm:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 text-sm font-semibold text-cream">Conferir anúncio <span aria-hidden="true">⌄</span></span>
          <span className="shrink-0 text-sm font-semibold text-brand">{price}</span>
        </summary>
        <div className="border-t border-white/10 p-3" aria-label="Conferência do anúncio">
          {children}
        </div>
      </details>
    </>
  );
}
