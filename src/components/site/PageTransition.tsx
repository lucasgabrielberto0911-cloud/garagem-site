"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Transição leve só com CSS — sem framer-motion (bundle pesado).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
