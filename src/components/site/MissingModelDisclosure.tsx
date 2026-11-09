"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * "Procurando outro modelo?": fechado no celular, aberto e sem seta no desktop.
 * Nasce aberto (HTML do servidor = desktop de sempre) e fecha ao hidratar abaixo de 1024 px.
 */
export function MissingModelDisclosure({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches && ref.current) {
      ref.current.open = false;
    }
  }, []);

  return (
    <details
      ref={ref}
      open
      className="group mt-10 border-t border-white/10 sm:mt-12 lg:border-t-0"
      data-missing-model=""
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-display text-base font-semibold text-cream lg:hidden [&::-webkit-details-marker]:hidden">
        <span>Procurando outro modelo?</span>
        <span aria-hidden="true" className="text-muted transition-transform duration-200 group-open:rotate-180">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
      </summary>
      {children}
    </details>
  );
}
