"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function VehicleFormFooter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const footer = ref.current;
    const form = footer?.closest("form");
    if (!footer || !form) return;
    // A altura muda com a etapa, o tamanho do texto e a área segura do celular.
    const measure = () => form.style.setProperty("--admin-form-footer-h", `${footer.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(footer, { box: "border-box" });
    return () => {
      observer.disconnect();
      form.style.removeProperty("--admin-form-footer-h");
    };
  }, []);

  return (
    <nav
      ref={ref}
      aria-label="Etapas do anúncio"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-asphalt px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] font-body text-cream sm:px-6 lg:left-64"
    >
      {children}
    </nav>
  );
}
