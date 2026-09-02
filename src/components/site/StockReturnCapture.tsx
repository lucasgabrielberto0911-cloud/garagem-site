"use client";

import type { ReactNode } from "react";
import { rememberStockReturn } from "@/lib/stock-return";

/**
 * Um único listener no grid: guarda filtro e scroll sem hidratar cada card.
 */
export function StockReturnCapture({
  returnTo,
  children,
}: {
  returnTo?: string;
  children: ReactNode;
}) {
  return (
    <div
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.closest("a[data-stock-card]")) return;
        rememberStockReturn(returnTo);
        try {
          sessionStorage.setItem(
            "garagem:estoque-scroll",
            String(window.scrollY),
          );
        } catch {
          // private mode
        }
      }}
    >
      {children}
    </div>
  );
}
